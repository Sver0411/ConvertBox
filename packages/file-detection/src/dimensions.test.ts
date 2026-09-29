import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readImageDimensions } from "./dimensions";

for (const [name, type] of [["sample.png", "png"], ["sample.jpg", "jpg"], ["sample.webp", "webp"]]) {
  it(`reads ${type} dimensions without decoding`, async () => {
    const bytes = readFileSync(resolve(__dirname, "../../../tests/fixtures", name));
    const dimensions = await readImageDimensions(new File([bytes], name), type);
    expect(dimensions?.width).toBeGreaterThan(0);
    expect(dimensions?.height).toBeGreaterThan(0);
  });
}
