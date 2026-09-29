# Privacy

All Phase 1 image conversions run in the visitor's browser. There is no upload endpoint in the web flow. The image File and converted Blob are kept only by the open page, and are released on removal or page close. A download URL is revoked after 30 seconds. The site does not store history or images in IndexedDB. It does not load a remote font service.

The web host still receives normal website requests (HTML, JavaScript, CSS and assets). Hosting providers may log those requests. This does not include image contents. Future features requiring server processing must display a Server label before upload, use short-lived temporary files and explain retention.
