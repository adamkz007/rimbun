// Minimal parser for legacy VTK POLYDATA files (ASCII or BINARY), as served
// by the Open Anatomy atlases. Returns triangle geometry only:
//   { positions: Float32Array, indices: Uint32Array }
// Supports POINTS, POLYGONS and TRIANGLE_STRIPS, in both the classic
// "<n> <size>" cell layout and the VTK 5.x OFFSETS/CONNECTIVITY layout.

const TYPE_SIZES = {
  float: 4,
  double: 8,
  int: 4,
  vtktypeint32: 4,
  vtktypeint64: 8,
  long: 8,
  unsigned_int: 4,
};

class Reader {
  constructor(buffer) {
    this.buf = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.pos = 0;
    this.binary = false;
    this.tokens = null;
  }

  done() {
    return this.pos >= this.buf.length;
  }

  readLine() {
    const start = this.pos;
    while (this.pos < this.buf.length && this.buf[this.pos] !== 0x0a) {
      this.pos++;
    }
    const line = this.buf.toString("latin1", start, this.pos).replace(/\r$/, "");
    this.pos++;
    return line;
  }

  nextHeaderLine() {
    while (!this.done()) {
      const line = this.readLine().trim();
      if (line) {
        return line;
      }
    }
    return null;
  }

  readAsciiNumbers(count) {
    const out = new Array(count);
    let filled = 0;
    while (filled < count) {
      if (this.done()) {
        throw new Error("Unexpected end of ASCII VTK data");
      }
      const parts = this.readLine().trim().split(/\s+/);
      for (const part of parts) {
        if (part && filled < count) {
          out[filled++] = Number(part);
        }
      }
    }
    return out;
  }

  readBinaryNumbers(count, type) {
    const size = TYPE_SIZES[type];
    if (!size) {
      throw new Error(`Unsupported VTK data type: ${type}`);
    }
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      const offset = this.pos + i * size;
      if (type === "float") out[i] = this.view.getFloat32(offset, false);
      else if (type === "double") out[i] = this.view.getFloat64(offset, false);
      else if (size === 8) out[i] = Number(this.view.getBigInt64(offset, false));
      else out[i] = this.view.getInt32(offset, false);
    }
    this.pos += count * size;
    // Binary blocks are followed by a newline before the next keyword.
    if (this.buf[this.pos] === 0x0a) this.pos++;
    return out;
  }

  readNumbers(count, type) {
    return this.binary ? this.readBinaryNumbers(count, type) : this.readAsciiNumbers(count);
  }
}

function readCells(reader, header) {
  const [, a, b] = header.split(/\s+/);
  const first = Number(a);
  const second = Number(b);

  // VTK 5.x: "POLYGONS <nOffsets> <nConnectivity>" followed by OFFSETS/CONNECTIVITY blocks.
  const peekPos = reader.pos;
  const next = reader.nextHeaderLine();
  if (next?.startsWith("OFFSETS")) {
    const offsets = reader.readNumbers(first, next.split(/\s+/)[1]);
    const connHeader = reader.nextHeaderLine();
    const connectivity = reader.readNumbers(second, connHeader.split(/\s+/)[1]);
    const cells = [];
    for (let i = 0; i < offsets.length - 1; i++) {
      cells.push(connectivity.slice(offsets[i], offsets[i + 1]));
    }
    return cells;
  }
  reader.pos = peekPos;

  const flat = reader.readNumbers(second, "int");
  const cells = [];
  let i = 0;
  while (i < flat.length && cells.length < first) {
    const n = flat[i];
    cells.push(flat.slice(i + 1, i + 1 + n));
    i += n + 1;
  }
  return cells;
}

export function parseVtk(buffer) {
  const reader = new Reader(buffer);
  reader.readLine(); // "# vtk DataFile Version x.y"
  reader.readLine(); // title
  const format = reader.readLine().trim().toUpperCase();
  reader.binary = format === "BINARY";

  let positions = null;
  const triangles = [];

  while (!reader.done()) {
    const line = reader.nextHeaderLine();
    if (!line) break;
    const keyword = line.split(/\s+/)[0].toUpperCase();

    if (keyword === "DATASET") {
      if (!/POLYDATA/i.test(line)) {
        throw new Error(`Unsupported dataset: ${line}`);
      }
    } else if (keyword === "POINTS") {
      const [, count, type] = line.split(/\s+/);
      positions = Float32Array.from(reader.readNumbers(Number(count) * 3, type));
    } else if (keyword === "POLYGONS") {
      for (const cell of readCells(reader, line)) {
        for (let k = 1; k < cell.length - 1; k++) {
          triangles.push(cell[0], cell[k], cell[k + 1]);
        }
      }
    } else if (keyword === "TRIANGLE_STRIPS") {
      for (const strip of readCells(reader, line)) {
        for (let k = 0; k < strip.length - 2; k++) {
          const [p, q, r] = [strip[k], strip[k + 1], strip[k + 2]];
          if (p === q || q === r || p === r) continue;
          if (k % 2 === 0) triangles.push(p, q, r);
          else triangles.push(q, p, r);
        }
      }
    } else if (keyword === "VERTICES" || keyword === "LINES") {
      readCells(reader, line); // skip
    } else {
      // POINT_DATA / CELL_DATA / attributes: nothing after this is geometry.
      break;
    }
  }

  if (!positions) {
    throw new Error("VTK file has no POINTS section");
  }

  return { positions, indices: Uint32Array.from(triangles) };
}
