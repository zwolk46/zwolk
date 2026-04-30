import type { Converter } from "../types.js";
import { builtinDataConverter } from "./builtinData.js";
import { calibreConverter } from "./calibre.js";
import { ffmpegConverter } from "./ffmpeg.js";
import { ghostscriptConverter } from "./ghostscript.js";
import { imagemagickConverter } from "./imagemagick.js";
import { inkscapeConverter } from "./inkscape.js";
import { libreofficeConverter } from "./libreoffice.js";
import { pandocConverter } from "./pandoc.js";
import { sevenZipConverter } from "./sevenzip.js";

export const ALL_CONVERTERS: Converter[] = [
  builtinDataConverter,
  imagemagickConverter,
  inkscapeConverter,
  sevenZipConverter,
  ffmpegConverter,
  libreofficeConverter,
  pandocConverter,
  ghostscriptConverter,
  calibreConverter
];
