import http from 'http';

export function createZipBuffer(filename, content) {
  const nameBuf = Buffer.from(filename);
  const dataBuf = Buffer.from(content);

  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(0, 6);
  lfh.writeUInt16LE(0, 8);
  lfh.writeUInt32LE(0, 10);
  lfh.writeUInt32LE(0, 14);
  lfh.writeUInt32LE(dataBuf.length, 18);
  lfh.writeUInt32LE(dataBuf.length, 22);
  lfh.writeUInt16LE(nameBuf.length, 26);
  lfh.writeUInt16LE(0, 28);
  const lfhTotal = Buffer.concat([lfh, nameBuf, dataBuf]);

  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(0, 8);
  cdh.writeUInt16LE(0, 10);
  cdh.writeUInt32LE(0, 12);
  cdh.writeUInt32LE(0, 16);
  cdh.writeUInt32LE(dataBuf.length, 20);
  cdh.writeUInt32LE(dataBuf.length, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt16LE(0, 30);
  cdh.writeUInt16LE(0, 32);
  cdh.writeUInt16LE(0, 34);
  cdh.writeUInt16LE(0, 36);
  cdh.writeUInt32LE(0, 38);
  cdh.writeUInt32LE(0, 42);
  const cdhTotal = Buffer.concat([cdh, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdhTotal.length, 12);
  eocd.writeUInt32LE(lfhTotal.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([lfhTotal, cdhTotal, eocd]);
}

export const PNG_BUFFER = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
export const VALID_ZIP_BUFFER = createZipBuffer('document.txt', 'Hello from SMMpro File Downloader test suite');
export const TRAVERSAL_ZIP_BUFFER = createZipBuffer('../../etc/passwd', 'root:x:0:0:root:/root:/bin/bash');

/**
 * Creates and starts a local mock HTTP server.
 * @returns {Promise<{ server: http.Server, baseUrl: string, close: () => Promise<void> }>}
 */
export function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = url.pathname;

      // Handle Range requests on /valid.zip
      if (pathname === '/valid.zip') {
        const rangeHeader = req.headers.range;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="smmpro_bundle.zip"');

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : VALID_ZIP_BUFFER.length - 1;
            const slice = VALID_ZIP_BUFFER.subarray(start, end + 1);
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${VALID_ZIP_BUFFER.length}`,
              'Content-Length': slice.length
            });
            if (req.method === 'HEAD') {
              return res.end();
            }
            return res.end(slice);
          }
        }

        res.setHeader('Content-Length', VALID_ZIP_BUFFER.length);
        if (req.method === 'HEAD') {
          return res.end();
        }
        return res.end(VALID_ZIP_BUFFER);
      }

      if (pathname === '/image.png') {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="photo.png"');
        res.setHeader('Content-Length', PNG_BUFFER.length);
        if (req.method === 'HEAD') return res.end();
        return res.end(PNG_BUFFER);
      }

      if (pathname === '/mismatched.pdf') {
        // PNG bytes disguised as PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="mismatched.pdf"');
        res.setHeader('Content-Length', PNG_BUFFER.length);
        if (req.method === 'HEAD') return res.end();
        return res.end(PNG_BUFFER);
      }

      if (pathname === '/no-extension') {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="data_export.zip"');
        res.setHeader('Content-Length', VALID_ZIP_BUFFER.length);
        if (req.method === 'HEAD') return res.end();
        return res.end(VALID_ZIP_BUFFER);
      }

      if (pathname === '/no-content-length') {
        res.setHeader('Content-Type', 'application/zip');
        // No Content-Length header; chunked transfer
        if (req.method === 'HEAD') return res.end();
        res.write(VALID_ZIP_BUFFER);
        return res.end();
      }

      if (pathname === '/redirect-chain') {
        return res.writeHead(302, { Location: '/redirect-1' }).end();
      }

      if (pathname === '/redirect-1') {
        return res.writeHead(302, { Location: '/valid.zip' }).end();
      }

      if (pathname === '/redirect-to-private') {
        return res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }).end();
      }

      if (pathname === '/redirect-loop') {
        return res.writeHead(302, { Location: '/redirect-loop' }).end();
      }

      if (pathname === '/html-page') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const html = `
          <!DOCTYPE html>
          <html>
            <head><title>SMMpro Downloads</title></head>
            <body>
              <h1>SMMpro Download Center</h1>
              <a href="/valid.zip" download="bundle.zip">Download ZIP Bundle</a>
              <a href="/image.png" title="Profile Image">Image File</a>
              <a href="https://example.com/files/manual.pdf">User Manual PDF</a>
              <a href="/valid.zip">Duplicate ZIP Link</a>
              <a href="#section-2">Internal Jump</a>
              <a href="javascript:void(0)">JS Action</a>
              <a href="http://192.168.1.1/router-login">Private Network Router</a>
            </body>
          </html>
        `;
        return res.end(html);
      }

      if (pathname === '/traversal.zip') {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="traversal.zip"');
        res.setHeader('Content-Length', TRAVERSAL_ZIP_BUFFER.length);
        if (req.method === 'HEAD') return res.end();
        return res.end(TRAVERSAL_ZIP_BUFFER);
      }

      if (pathname === '/large-file') {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');
        const totalSize = 2147483648; // 2 GB

        if (req.headers.range) {
          const match = req.headers.range.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : start + 16383;
            const len = Math.max(0, end - start + 1);
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': len
            });
            if (req.method === 'HEAD') return res.end();
            return res.end(Buffer.alloc(len));
          }
        }

        res.setHeader('Content-Length', totalSize);
        if (req.method === 'HEAD') return res.end();
        return res.end(Buffer.alloc(100));
      }

      if (pathname === '/requires-auth') {
        res.setHeader('WWW-Authenticate', 'Basic realm="Test"');
        return res.writeHead(401).end();
      }

      if (pathname === '/error-500') {
        return res.writeHead(500).end();
      }

      if (pathname === '/timeout') {
        // Never respond to trigger timeout
        return;
      }

      res.writeHead(404).end();
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        server,
        baseUrl,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

export default {
  startMockServer,
  createZipBuffer,
  PNG_BUFFER,
  VALID_ZIP_BUFFER,
  TRAVERSAL_ZIP_BUFFER
};
