import type { SpiNorProfile } from "@/domain/spi/nor/SpiNorProfile";
import { winbondW25q32 } from "@/domain/spi/nor/profiles/winbondW25q32";

const all: SpiNorProfile[] = [winbondW25q32];

export function listNorProfiles(): readonly SpiNorProfile[] {
  return all;
}

export function matchNorProfile(
  manufacturerId: number,
  deviceIdHigh: number,
  deviceIdLow: number,
): SpiNorProfile | undefined {
  return all.find(
    (p) =>
      p.jedec.manufacturerId === manufacturerId &&
      p.jedec.deviceIdHigh === deviceIdHigh &&
      p.jedec.deviceIdLow === deviceIdLow,
  );
}
