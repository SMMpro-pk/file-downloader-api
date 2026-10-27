/**
 * SMMpro File Downloader API - File Type Registry
 * Defines supported categories, extensions, standard MIME types, and detection classification.
 */

export const FILE_CATEGORIES = {
  ARCHIVE: 'archive',
  DOCUMENT: 'document',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  PACKAGE: 'package'
};

export const SUPPORTED_FORMATS = {
  // Archives
  zip: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/zip', 'application/x-zip-compressed'], description: 'ZIP Archive' },
  rar: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/vnd.rar', 'application/x-rar-compressed'], description: 'RAR Archive' },
  '7z': { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/x-7z-compressed'], description: '7-Zip Archive' },
  tar: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/x-tar'], description: 'TAR Archive' },
  gz: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/gzip', 'application/x-gzip'], description: 'Gzip Archive' },
  bz2: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/x-bzip2'], description: 'Bzip2 Archive' },
  xz: { category: FILE_CATEGORIES.ARCHIVE, mimes: ['application/x-xz'], description: 'XZ Archive' },

  // Documents
  pdf: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/pdf'], description: 'Portable Document Format' },
  doc: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/msword'], description: 'Microsoft Word Document (Legacy)' },
  docx: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], description: 'Microsoft Word Document' },
  xls: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/vnd.ms-excel'], description: 'Microsoft Excel Spreadsheet (Legacy)' },
  xlsx: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], description: 'Microsoft Excel Spreadsheet' },
  ppt: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/vnd.ms-powerpoint'], description: 'Microsoft PowerPoint Presentation (Legacy)' },
  pptx: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], description: 'Microsoft PowerPoint Presentation' },
  txt: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['text/plain'], description: 'Plain Text File' },
  csv: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['text/csv', 'application/csv', 'text/x-csv'], description: 'Comma-Separated Values' },
  epub: { category: FILE_CATEGORIES.DOCUMENT, mimes: ['application/epub+zip'], description: 'Electronic Publication' },

  // Images
  jpg: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/jpeg'], description: 'JPEG Image' },
  jpeg: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/jpeg'], description: 'JPEG Image' },
  png: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/png'], description: 'Portable Network Graphics' },
  webp: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/webp'], description: 'WebP Image' },
  gif: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/gif'], description: 'Graphics Interchange Format' },
  svg: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/svg+xml'], description: 'Scalable Vector Graphics' },
  tiff: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/tiff'], description: 'Tagged Image File Format' },
  bmp: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/bmp', 'image/x-ms-bmp'], description: 'Bitmap Image' },
  avif: { category: FILE_CATEGORIES.IMAGE, mimes: ['image/avif'], description: 'AV1 Image File Format' },

  // Audio
  mp3: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/mpeg', 'audio/mp3'], description: 'MPEG Audio Layer III' },
  wav: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/wav', 'audio/x-wav'], description: 'Waveform Audio File Format' },
  flac: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/flac', 'audio/x-flac'], description: 'Free Lossless Audio Codec' },
  aac: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/aac'], description: 'Advanced Audio Coding' },
  m4a: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/mp4', 'audio/x-m4a'], description: 'MPEG-4 Audio' },
  ogg: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/ogg', 'application/ogg'], description: 'Ogg Vorbis Audio' },
  opus: { category: FILE_CATEGORIES.AUDIO, mimes: ['audio/opus'], description: 'Opus Audio' },

  // Video
  mp4: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/mp4'], description: 'MPEG-4 Video' },
  webm: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/webm'], description: 'WebM Video' },
  mov: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/quicktime'], description: 'QuickTime Movie' },
  mkv: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/x-matroska'], description: 'Matroska Video' },
  avi: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/x-msvideo'], description: 'Audio Video Interleave' },
  mpeg: { category: FILE_CATEGORIES.VIDEO, mimes: ['video/mpeg'], description: 'MPEG Video' },

  // Software & Packages
  apk: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/vnd.android.package-archive'], description: 'Android Package' },
  exe: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/x-msdownload', 'application/x-dosexec', 'application/vnd.microsoft.portable-executable'], description: 'Windows Executable' },
  msi: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/x-msi', 'application/x-ole-storage'], description: 'Windows Installer Package' },
  dmg: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/x-apple-diskimage'], description: 'Apple Disk Image' },
  iso: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/x-iso9660-image'], description: 'ISO Disk Image' },
  deb: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/vnd.debian.binary-package', 'application/x-deb'], description: 'Debian Software Package' },
  rpm: { category: FILE_CATEGORIES.PACKAGE, mimes: ['application/x-rpm'], description: 'Red Hat Package Manager' }
};

/**
 * Maps common MIME types to known extensions.
 */
export const MIME_TO_EXT_MAP = new Map();
for (const [ext, info] of Object.entries(SUPPORTED_FORMATS)) {
  for (const mime of info.mimes) {
    if (!MIME_TO_EXT_MAP.has(mime.toLowerCase())) {
      MIME_TO_EXT_MAP.set(mime.toLowerCase(), ext);
    }
  }
}

/**
 * Formats that cannot always be reliably identified by magic bytes alone.
 */
export const TEXT_OR_CONTAINER_FORMATS = new Set([
  'txt', 'csv', 'svg', 'tar', 'docx', 'xlsx', 'pptx', 'epub', 'apk'
]);

/**
 * Returns category and info for a given file extension.
 * @param {string} ext
 */
export function getFormatInfoByExtension(ext) {
  if (!ext) return null;
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  return SUPPORTED_FORMATS[cleanExt] || null;
}

/**
 * Returns category and info for a given MIME type.
 * @param {string} mimeType
 */
export function getFormatInfoByMime(mimeType) {
  if (!mimeType) return null;
  const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
  const ext = MIME_TO_EXT_MAP.get(cleanMime);
  if (ext) {
    return { ext, ...SUPPORTED_FORMATS[ext] };
  }
  return null;
}
