# legacy

The CPU pipeline, kept for reference and no longer reachable from the app.

Until the marching moved to the GPU, the field was a `Float32Array` that
`metaballs.js` filled every frame and `MarchingCubesGeometry.js` polygonised
into a `BufferGeometry`, which `metaballVs.js` then drew. All three are now done
by `modules/volume.js` and `shaders/marchVs.js` instead, on the GPU, and the
field never reaches the CPU at all.

- `MarchingCubesGeometry.js` — the CPU polygoniser. Its triangle table was the
  one part the GPU path still needed and now lives in `modules/triTable.js`;
  what remains here is the traversal, the vertex interpolation and the normal
  cache.
- `metaballs.js` — the CPU field: the metaball falloff, the shape distance laid
  into the same field, `blurField` for the smooth control, and `resampleField`
  for building the core on a coarser grid. Every one of those has a counterpart
  in `shaders/field.js` or `modules/volume.js`, and the blur in particular was
  ported term for term, including the fact that it reads only the eight diagonal
  neighbours with a running mean whose divisor climbs as it goes.
- `metaballVs.js` — the vertex shader for a mesh that already had positions and
  normals in buffers. `shaders/marchVs.js` computes both from the field instead.
- `metaballFsTBN.js` — an earlier surface shader, unreferenced for far longer
  than the rest of this.

Nothing here is imported. It is here because it is the readable version of what
the GPU now does, and because the shader ports were checked against it.
