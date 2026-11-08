import loader from '@/assets/ephemera/loader.svg?inline';
import download from '@/assets/ephemera/download.svg?inline';
import downloadAll from '@/assets/ephemera/download-all.svg?inline';
import logo from '@/assets/ephemera/logo.svg?inline';

/** CSS `background-image` values for the Ephemera button states (inlined at build time). */
export const ICON_LOADING = `url("${loader}")`;
export const ICON_DOWNLOAD = `url("${download}")`;
export const ICON_DOWNLOAD_ALL = `url("${downloadAll}")`;

/** The Ephemera logo as a data URL, for markup injected into pages. */
export const LOGO_URL = logo;
