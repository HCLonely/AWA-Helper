const gulp = require('gulp');
const inlinesource = require('gulp-inline-source');
const rename = require('gulp-rename');
const htmlmin = require('gulp-htmlmin');

gulp.task('inlinesourceWebUI', () => gulp.src('./src/webUI/index.html')
  .pipe(inlinesource({
    compress: false
  }))
  .pipe(htmlmin({
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true
  }))
  .pipe(gulp.dest('./src/webUI/dist')));
gulp.task('inlinesourceManager', () => gulp.src('./src/manager/index.html')
  .pipe(inlinesource({
    compress: false
  }))
  .pipe(htmlmin({
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true
  }))
  .pipe(gulp.dest('./src/manager/dist')));
gulp.task('inlinesourceConfiger', () => gulp.src('./src/manager/configer/index.html')
  .pipe(rename('configer.html'))
  .pipe(inlinesource({
    compress: false
  }))
  .pipe(htmlmin({
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true
  }))
  .pipe(gulp.dest('./src/manager/dist')));

gulp.task('default', gulp.series(gulp.parallel('inlinesourceWebUI', 'inlinesourceManager', 'inlinesourceConfiger')));
