import type { MatrixCell } from "../types";
import { ch341aMiniProgrammerCells } from "./ch341aMiniProgrammer.matrix";
import { ftdiMpsseMatrixCells } from "./ftdiMpsse.matrix";
import { silabsCpMatrixCells } from "./silabsCp.matrix";

export const allMatrixCells: MatrixCell[] = [
  ...ch341aMiniProgrammerCells,
  ...ftdiMpsseMatrixCells,
  ...silabsCpMatrixCells,
];
