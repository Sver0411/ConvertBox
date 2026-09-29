import { describe, expect, it } from "vitest";
import { detectFileType, extensionOf, signatureOf } from "./detect";

const PNG = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const JPG = new Uint8Array([255,216,255,224,0,0]);
const WEBP = new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]);

describe("file detection", () => {
  it("parses extensions safely", () => {
    expect(extensionOf("C:\\tmp\\你好.JPEG")).toBe("jpeg");
    expect(extensionOf(".hidden")).toBe("");
  });
  it("recognizes signatures", () => {
    expect(signatureOf(PNG)).toBe("png");
    expect(signatureOf(JPG)).toBe("jpg");
    expect(signatureOf(WEBP)).toBe("webp");
    expect(signatureOf(new Uint8Array([1,2,3]))).toBe("unknown");
  });
  it("rejects contradictory extensions", async () => {
    const file = new File([PNG], "fake.jpg", { type: "image/jpeg" });
    const descriptor = await detectFileType(file);
    expect(descriptor.category).toBe("unsupported");
    expect(descriptor.error).toMatch(/extension says JPG/);
  });
  it("accepts matching PNG bytes", async () => {
    const descriptor = await detectFileType(new File([PNG], "图像.png", { type: "image/png" }));
    expect(descriptor.category).toBe("image");
    expect(descriptor.supportedConversions).toEqual(["jpg", "png", "webp"]);
  });
});
