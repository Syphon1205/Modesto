# Device models

Real handset models for the device pane's free-look view. Drop licensed `.glb`
files here and register them in
`apps/web/src/components/device/deviceModelRegistry.ts`.

This directory is empty on purpose. The pane falls back to the procedural
chassis in `deviceChassis.ts` when a model is missing, so nothing here is
required to build or run Modesto — a model only raises fidelity.

## Adding one

1. Put the `.glb` in this directory.
2. Run the inspector to read out its node names:

   ```
   bun run devices:inspect apps/web/public/devices/your-model.glb
   ```

3. Paste the entry it prints into `DEVICE_MODELS`, filling in the credit block.
4. Add the model to `THIRD_PARTY_NOTICES.md`.

## What the loader expects

Nothing about units, orientation, or scale — the loader measures the bounding
box and normalizes. What it does need from the contract:

- `screenNode`: the display mesh. Its bounding box positions the live video
  quad; the mesh itself is hidden, and its own UVs are never used.
- `buttonNodes` (optional): meshes to make pressable, keyed by the action names
  in `NUB_ACTIONS` (`power`, `volumeUp`, `volumeDown`, `volumeRocker`).
- `rotation` (optional): for models authored Z-up or facing away.
- `hideNodes` (optional): baked-in screen content, stands, shadow planes.

Keep files under roughly 12 MB and 200k triangles; the same pane is decoding
H.264 at video rate. Draco geometry and KTX2 textures are both supported.

## Licensing

These are third-party depictions of trademarked industrial design. A Creative
Commons licence on a mesh is the uploader's grant over their own modelling work
— it says nothing about Apple's, Google's, or Samsung's rights in how the
product looks. Check that the intended use is one you are comfortable with
before adding a model, and record the licence in the credit block either way.
