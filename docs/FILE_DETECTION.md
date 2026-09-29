# File detection

`packages/file-detection/src/detect.ts` reads the start of a browser File and compares the signature to its extension and MIME type. It recognizes JPEG, PNG, WebP, GIF, BMP, PDF, ISO-BMFF images/media, Ogg, FLAC, WAV, MP3/AAC, Matroska/WebM and Office containers. ZIP-based Office documents use their filename to propose a type in the browser; the server checks actual ZIP members before processing. Detection is preliminary: full decoders still reject truncated or unsupported codec variants.

`apps/api/convertbox_api/detection.py` independently checks magic bytes. It inspects ZIP members for OOXML or OpenDocument markers, rejects containers with more than 10,000 entries or over 500 MB expanded size, and uses ffprobe to verify that media has the expected stream type. Filename and client MIME never authorize conversion by themselves. Malformed and mismatched files fail before queue submission.
