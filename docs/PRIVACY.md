# Privacy

Each file row shows Local or Server before conversion. JPG/PNG/WebP conversion at or below 25 MB stays in the browser when the chosen output is one of those formats. Browser data is held only while the page is open; local downloads use temporary object URLs.

Server tasks upload files to a self-hosted FastAPI instance through the same-origin web proxy. Each upload and result resides in a random per-job directory. Completed or failed jobs are deleted after the configured TTL, one hour by default. Server downloads and request metadata may appear in hosting/proxy logs, depending on deployment. No conversion SaaS is used.

IndexedDB stores only recent conversion metadata and settings, capped at 200 entries. It never stores source or output Blobs. Users can clear the history in the interface. Custom presets stay in localStorage on that browser. No account is required.
