import ApplicationServices
import AppKit
import CoreGraphics
import Darwin
import Foundation
import ImageIO

// MARK: - Wire protocol

struct AppshotEvent: Encodable {
  let type: String
  let appName: String
  let windowTitle: String
  let accessibilityText: String
  let pngBase64: String
  let capturedAt: String
}

struct AppshotErrorEvent: Encodable {
  let type: String
  let message: String
}

// MARK: - Double Option (left + right Alt)

/// Pure state machine mirrored by `apps/desktop/src/appshots/doubleOption.ts`.
final class DoubleOptionTracker {
  private var leftDown = false
  private var rightDown = false
  private var firedWhileBothDown = false

  enum Key {
    case leftOption
    case rightOption
  }

  /// Returns true exactly once per both-Option press gesture.
  @discardableResult
  func note(key: Key, isDown: Bool) -> Bool {
    switch key {
    case .leftOption:
      leftDown = isDown
    case .rightOption:
      rightDown = isDown
    }
    if leftDown && rightDown {
      if firedWhileBothDown {
        return false
      }
      firedWhileBothDown = true
      return true
    }
    firedWhileBothDown = false
    return false
  }

  /// Poll HID key state for left (0x3A) and right (0x3D) Option.
  @discardableResult
  func syncFromSystem() -> Bool {
    let left = CGEventSource.keyState(.hidSystemState, key: 0x3A)
    let right = CGEventSource.keyState(.hidSystemState, key: 0x3D)
    leftDown = left
    rightDown = right
    if left && right {
      if firedWhileBothDown {
        return false
      }
      firedWhileBothDown = true
      return true
    }
    firedWhileBothDown = false
    return false
  }
}

// MARK: - Capture

private let maxAccessibilityCharacters = 120_000

private func frontmostWindowInfo() -> (
  windowID: CGWindowID,
  appName: String,
  windowTitle: String,
  pid: pid_t
)? {
  let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
  guard let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    return nil
  }

  let frontPid = NSWorkspace.shared.frontmostApplication?.processIdentifier

  for info in infoList {
    let layer = info[kCGWindowLayer as String] as? Int ?? -1
    guard layer == 0 else { continue }
    guard let windowNumber = info[kCGWindowNumber as String] as? NSNumber else { continue }
    let ownerPid = info[kCGWindowOwnerPID as String] as? pid_t
    if let frontPid, let ownerPid, ownerPid != frontPid {
      continue
    }
    let appName = (info[kCGWindowOwnerName as String] as? String) ?? "Unknown"
    let windowTitle = (info[kCGWindowName as String] as? String) ?? ""
    if let boundsDict = info[kCGWindowBounds as String] as? [String: Any] {
      let height = (boundsDict["Height"] as? NSNumber)?.doubleValue ?? 0
      let width = (boundsDict["Width"] as? NSNumber)?.doubleValue ?? 0
      if height < 40 || width < 40 {
        continue
      }
    }
    return (CGWindowID(windowNumber.uint32Value), appName, windowTitle, ownerPid ?? 0)
  }
  return nil
}

private func pngData(for windowID: CGWindowID) -> Data? {
  let imageOptions: CGWindowImageOption = [.boundsIgnoreFraming, .bestResolution]
  guard let cgImage = CGWindowListCreateImage(
    .null,
    .optionIncludingWindow,
    windowID,
    imageOptions
  ) else {
    return nil
  }
  let data = NSMutableData()
  guard let destination = CGImageDestinationCreateWithData(
    data,
    "public.png" as CFString,
    1,
    nil
  ) else {
    return nil
  }
  CGImageDestinationAddImage(destination, cgImage, nil)
  guard CGImageDestinationFinalize(destination) else {
    return nil
  }
  return data as Data
}

private func collectAccessibilityText(pid: pid_t) -> String {
  let appElement = AXUIElementCreateApplication(pid)
  var collected = ""
  var visited = 0
  let maxNodes = 2_500

  func appendText(_ value: String) {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    if collected.count + trimmed.count + 1 > maxAccessibilityCharacters {
      return
    }
    if !collected.isEmpty {
      collected.append("\n")
    }
    collected.append(trimmed)
  }

  func readStringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    guard result == .success else { return nil }
    if let string = value as? String {
      return string
    }
    if let number = value as? NSNumber {
      return number.stringValue
    }
    if let attributed = value as? NSAttributedString {
      return attributed.string
    }
    return nil
  }

  func walk(_ element: AXUIElement, depth: Int) {
    if visited >= maxNodes || collected.count >= maxAccessibilityCharacters || depth > 40 {
      return
    }
    visited += 1

    if let value = readStringAttribute(element, kAXValueAttribute as String) {
      appendText(value)
    } else if let title = readStringAttribute(element, kAXTitleAttribute as String) {
      appendText(title)
    } else if let desc = readStringAttribute(element, kAXDescriptionAttribute as String) {
      appendText(desc)
    }

    var childrenObject: AnyObject?
    let childrenResult = AXUIElementCopyAttributeValue(
      element,
      kAXChildrenAttribute as CFString,
      &childrenObject
    )
    guard childrenResult == .success, let children = childrenObject as? [AXUIElement] else {
      return
    }
    for child in children {
      walk(child, depth: depth + 1)
      if collected.count >= maxAccessibilityCharacters || visited >= maxNodes {
        break
      }
    }
  }

  let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
  _ = AXIsProcessTrustedWithOptions(opts)

  var windowsObject: AnyObject?
  if AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsObject)
    == .success,
    let windows = windowsObject as? [AXUIElement],
    let first = windows.first
  {
    walk(first, depth: 0)
  } else {
    walk(appElement, depth: 0)
  }

  return collected
}

private func captureAppshot() -> (event: AppshotEvent?, error: String?) {
  guard let info = frontmostWindowInfo() else {
    return (nil, "No frontmost window found")
  }
  guard let png = pngData(for: info.windowID) else {
    return (
      nil,
      "Failed to capture window image (Screen Recording permission may be required)"
    )
  }
  let accessibilityText = info.pid > 0 ? collectAccessibilityText(pid: info.pid) : ""
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return (
    AppshotEvent(
      type: "appshot",
      appName: info.appName,
      windowTitle: info.windowTitle,
      accessibilityText: accessibilityText,
      pngBase64: png.base64EncodedString(),
      capturedAt: formatter.string(from: Date())
    ),
    nil
  )
}

// MARK: - Unix socket server

final class AppshotServer {
  private let socketPath: String
  private var serverFd: Int32 = -1
  private var clientFds: [Int32] = []
  private let lock = NSLock()
  private let tracker = DoubleOptionTracker()
  private let encoder = JSONEncoder()
  private var eventTap: CFMachPort?

  init(socketPath: String) {
    self.socketPath = socketPath
  }

  func start() throws {
    try? FileManager.default.removeItem(atPath: socketPath)

    serverFd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard serverFd >= 0 else {
      throw NSError(
        domain: "AppshotHelper",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "socket() failed"]
      )
    }

    var addr = sockaddr_un()
    addr.sun_family = sa_family_t(AF_UNIX)
    let pathBytes = socketPath.utf8CString
    guard pathBytes.count <= MemoryLayout.size(ofValue: addr.sun_path) else {
      throw NSError(
        domain: "AppshotHelper",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "socket path too long"]
      )
    }
    _ = withUnsafeMutablePointer(to: &addr.sun_path.0) { ptr in
      pathBytes.withUnsafeBytes { bytes in
        memcpy(ptr, bytes.baseAddress!, bytes.count)
      }
    }

    let bindResult = withUnsafePointer(to: &addr) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
        Darwin.bind(serverFd, sockPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard bindResult == 0 else {
      throw NSError(
        domain: "AppshotHelper",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "bind() failed"]
      )
    }
    guard Darwin.listen(serverFd, 4) == 0 else {
      throw NSError(
        domain: "AppshotHelper",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "listen() failed"]
      )
    }

    DispatchQueue.global(qos: .utility).async { [weak self] in
      self?.acceptLoop()
    }
    installEventTap()
    startStdinReader()
  }

  private func acceptLoop() {
    while true {
      let client = Darwin.accept(serverFd, nil, nil)
      if client < 0 {
        continue
      }
      lock.lock()
      clientFds.append(client)
      lock.unlock()
    }
  }

  private func broadcast<T: Encodable>(_ value: T) {
    guard var data = try? encoder.encode(value) else { return }
    data.append(0x0A)
    lock.lock()
    let fds = clientFds
    lock.unlock()
    var stale: [Int32] = []
    for fd in fds {
      let wrote = data.withUnsafeBytes { ptr -> Int in
        guard let base = ptr.baseAddress else { return -1 }
        return Darwin.write(fd, base, data.count)
      }
      if wrote < 0 {
        stale.append(fd)
      }
    }
    if !stale.isEmpty {
      lock.lock()
      clientFds.removeAll { stale.contains($0) }
      lock.unlock()
      for fd in stale {
        Darwin.close(fd)
      }
    }
  }

  func performCapture() {
    let result = captureAppshot()
    if let event = result.event {
      broadcast(event)
    } else {
      broadcast(AppshotErrorEvent(type: "error", message: result.error ?? "Unknown capture error"))
    }
  }

  private func installEventTap() {
    let mask = CGEventMask(1 << CGEventType.flagsChanged.rawValue)
    let callback: CGEventTapCallBack = { _, type, event, userInfo in
      guard type == .flagsChanged, let userInfo else {
        return Unmanaged.passUnretained(event)
      }
      let server = Unmanaged<AppshotServer>.fromOpaque(userInfo).takeUnretainedValue()
      let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
      // 0x3A left Option, 0x3D right Option
      if keyCode == 0x3A || keyCode == 0x3D {
        if server.tracker.syncFromSystem() {
          DispatchQueue.global(qos: .userInitiated).async {
            server.performCapture()
          }
        }
      }
      return Unmanaged.passUnretained(event)
    }

    guard let tap = CGEvent.tapCreate(
      tap: .cgSessionEventTap,
      place: .headInsertEventTap,
      options: .listenOnly,
      eventsOfInterest: mask,
      callback: callback,
      userInfo: UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
    ) else {
      fputs(
        "error: failed to create CGEventTap (Accessibility permission may be required)\n",
        stderr
      )
      return
    }
    eventTap = tap
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
  }

  private func startStdinReader() {
    DispatchQueue.global(qos: .utility).async { [weak self] in
      while let line = readLine(strippingNewline: true) {
        let command = line.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if command == "quit" {
          exit(0)
        }
        if command == "capture" {
          self?.performCapture()
        }
      }
    }
  }
}

func main() {
  let socketPath =
    ProcessInfo.processInfo.environment["MODESTO_APPSHOT_SOCKET"]?
    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  guard !socketPath.isEmpty else {
    fputs("error: MODESTO_APPSHOT_SOCKET is required\n", stderr)
    exit(1)
  }

  let server = AppshotServer(socketPath: socketPath)
  do {
    try server.start()
  } catch {
    fputs("error: failed to start appshot helper: \(error)\n", stderr)
    exit(1)
  }

  RunLoop.main.run()
}

main()
