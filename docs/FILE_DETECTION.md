# File detection

`detectFileType(file)` returns a `FileDescriptor` with name, extension, MIME, detected type, size, category, signature, supported conversions and an optional error. It reads the first 16 bytes via `file.slice(0, 16).arrayBuffer()`.

Recognized signatures: JPEG `FF D8 FF`, PNG's eight-byte signature, and WebP's `RIFF....WEBP`. A known extension or known MIME that contradicts the signature is rejected. Missing extension or MIME can still be accepted when the signature is supported. A matching header is preliminary identification; the real image decoder may still reject truncated or corrupted content.

The same detection logic is covered by unit tests. Future server uploads must repeat independent byte detection; browser descriptors are untrusted outside the local path.
