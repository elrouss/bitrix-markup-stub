const { src, dest, parallel, series, watch } = require('gulp');

let stageDirname = 'public';

const sass = require('gulp-sass')(require('sass'));
const autoprefixer = require('gulp-autoprefixer');
const gcmq = require('gulp-group-css-media-queries');

const babel = require('gulp-babel');

const del = require('del');
const localServer = require('browser-sync').create();
const include = require('gulp-include');

const svgSpritesBuilder = require('gulp-svg-sprite');
const cheerio = require('gulp-cheerio');
const plumber = require('gulp-plumber');

function upLocalServer() {
  localServer.init({
    server: {
      baseDir: `${stageDirname}/`,
      serveStaticOptions: {
        extensions: ['html'],
      },
    },
    port: 8080,
    ui: { port: 8081 },
    open: true,
  })
}

function styles() {
  return src('src/app/index.+(scss|sass)')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      grid: true,
      overrideBrowserslist: ['last 10 version'],
    }))
    .pipe(gcmq())
    .pipe(dest(`${stageDirname}/css/`))
    .pipe(localServer.stream())
}

function scripts() {
  return src('src/app/index.js')
    .pipe(include({ hardFail: true }))
    .pipe(babel({
      presets: ['@babel/env'],
    }))
    .pipe(dest(`${stageDirname}/js/`))
    .pipe(localServer.stream())
}

function pages() {
  return src('src/pages/*.html')
    .pipe(include({ hardFail: true }))
    .pipe(dest(`${stageDirname}/`))
    .pipe(localServer.reload({ stream: true, }))
}

function copyFonts() {
  return src('src/core/assets/fonts/**/*')
    .pipe(dest(`${stageDirname}//assets/fonts/`))
}

function copyImages() {
  return src('src/core/assets/media/**/*')
    .pipe(dest(`${stageDirname}/assets/media/`))
}

function copyVendors() {
  return src('src/core/vendors/**/*')
    .pipe(dest(`${stageDirname}/vendors/`))
}

const extendedSvgSpritesBuilder = (mode) => {
  return (cb) => {
    const pipeline = src('src/core/assets/icons/**/*.svg')
    if (mode === 'clean') {
      pipeline
        .pipe(cheerio({
          run($) {
            $('[fill]').removeAttr('fill');
            $('[stroke]').removeAttr('stroke');
            $('[style]').removeAttr('style');
          },
          parserOptions: { xmlMode: true },
        }))
        .pipe(plumber())
    }

    pipeline
      .pipe(svgSpritesBuilder({
        shape: {
          dimension: {
            maxWidth: 48,
            maxHeight: 48,
          },
        },
        mode: {
          symbol: {
            dest: mode,
            inline: true,
            sprite: './sprite.svg',
          },
        },
      }))
      .pipe(plumber())
      .pipe(dest(`${stageDirname}/assets/icons/`))
      .on('end', cb)
      .on('error', cb)

    return pipeline;
  };
};

function buildCleanSvgSprites(cb) {
  return extendedSvgSpritesBuilder('clean')(cb);
};

function buildDefaultSvgSprites(cb) {
  return extendedSvgSpritesBuilder('default')(cb);
};

function buildSvgSprites() {
  return parallel(
    buildCleanSvgSprites,
    buildDefaultSvgSprites,
  );
};

async function copyResources() {
  copyFonts()
  copyImages()
  copyVendors()
}

async function clean() {
  return del.sync(`${stageDirname}/`, { force: true })
}

function watching() {
  watch(['src/app/index.js', 'src/components/**/*.js', 'src/core/components/**/*.js'], scripts)
  watch(['src/app/index.+(scss|sass)', 'src/core/**/*.+(scss|sass)', 'src/components/**/*.+(scss|sass)'], styles).on(
    'change',
    localServer.reload
  )
  watch(['src/pages/*.html', 'src/components/**/*.html'], pages).on(
    'change',
    localServer.reload
  )
}

function setDevStage(finishTask) {
  stageDirname = 'dev';

  finishTask();
};

exports.localServer = localServer
exports.clean = clean
exports.scripts = scripts
exports.styles = styles
exports.pages = pages
exports.copyResources = copyResources
exports.buildSvgSprites = buildSvgSprites

exports.default = series(
  setDevStage,
  parallel(
    clean,
    styles,
    scripts,
    copyResources,
    buildSvgSprites(),
    pages,
    upLocalServer,
    watching,
  ),
);

exports.build = series(
  clean,
  styles,
  scripts,
  copyResources,
  pages
)




