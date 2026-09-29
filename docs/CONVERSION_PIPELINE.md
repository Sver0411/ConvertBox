# Conversion pipeline

1. The File API provides a `File` without copying it to a base64 string.
2. Detection reads only the first 16 bytes into an ArrayBuffer and compares magic bytes, extension and MIME.
3. The UI looks up the actual capability matrix and the browser's encoder probe.
4. Up to two jobs run concurrently. Each job has its own AbortController. A queued cancellation prevents work from starting; a Worker cancellation terminates that Worker.
5. `createImageBitmap` decodes into pixels. The converter rejects images over 80 million pixels. Canvas re-encodes into a Blob. JPEG fills transparent pixels with white. ImageBitmap is closed after use; the fallback revokes its source object URL.
6. The UI holds the output Blob until removal or page close. Individual downloads create a temporary object URL, revoked after 30 seconds. ZIP is built on demand and capped at 200 MB of output bytes.

The browser encoder does not provide a fractional progress callback. Individual rows show honest stages (queued, decoding, encoding, completed). The batch bar counts settled files, so its fraction is real. This is not a byte progress estimate.

Input file size and decoded pixel limits are separate. A small compressed image can still expand to a large pixel buffer. Browser memory use varies by platform; the current limits are a conservative first guard, not a formal maximum-memory guarantee.
