const nav = document.getElementById("nav");
const onScroll = () => {
  nav?.classList.toggle("is-on", window.scrollY > 8);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

function platformLabel() {
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return "Download for Windows";
  if (/Linux/i.test(ua)) return "Download for Linux";
  return "Download for macOS";
}

const label = platformLabel();
for (const id of ["hero-download", "cta-download"]) {
  const node = document.getElementById(id);
  if (node) node.textContent = label;
}
