import type { MatrixCell } from "@/matrix/types";
import { ch341aMiniProgrammerCells } from "@/matrix/presets/ch341aMiniProgrammer.matrix";
import { ftdiMpsseMatrixCells } from "@/matrix/presets/ftdiMpsse.matrix";
import { silabsCpMatrixCells } from "@/matrix/presets/silabsCp.matrix";

export const allMatrixCells: MatrixCell[] = [
  ...ch341aMiniProgrammerCells,
  ...ftdiMpsseMatrixCells,
  ...silabsCpMatrixCells,
];
