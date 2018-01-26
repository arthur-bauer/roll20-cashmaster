/*
yarn
*/

const gulp = require('gulp');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const replace = require('gulp-string-replace');
const gfi = require('gulp-file-insert');
const markdown = require('gulp-markdown');
const del = require('del');
const bump = require('gulp-bump');
const jsonlint = require('gulp-jsonlint');
const p = require('./package.json');

const version = p.version.replace('v', '');

// ### Version number bump routines
//
// Basic usage:
// Will patch the version

const bumpVersion = (type) => {
  gulp.src('./package.json')
    .pipe(bump({ type }))
    .pipe(gulp.dest('./'));
};
gulp.task('bump-major', () => bumpVersion('major'));
gulp.task('bump-minor', () => bumpVersion('minor'));
gulp.task('bump-patch', () => bumpVersion('patch'));
gulp.task('bump-pre', () => bumpVersion('prepatch'));

gulp.task('lint', () => gulp.src(['./*.js'])
  .pipe(eslint())
  .pipe(eslint.format())
  .pipe(eslint.failAfterError()));

// prepare the three readme versions
// - a html version for inline help
// - a md with converted linebreaks for the json
// - and the clean md for the publish folder

gulp.task('pub1', () => {
  gulp.src('./README.md')
    .pipe(markdown())
    .pipe(replace(new RegExp('\n', 'g'), '')) // eslint-disable-line no-control-regex
    .pipe(replace(new RegExp('"', 'g'), '\''))
    .pipe(gulp.dest('./tmp/script'));

  gulp.src('./README.md')
    .pipe(replace(new RegExp('\n', 'g'), '\\r')) // eslint-disable-line no-control-regex
    .pipe(replace(new RegExp('"', 'g'), '\''))
    .pipe(gulp.dest('./tmp/package'));

  gulp.src('./README.md')
    .pipe(gulp.dest('./publish'));

  gulp.src('./prep/script.json')
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
});

// Then, replace vn and readme content in Cashmaster.js
// and script.json and write everything to the publish folder
// The package.json still needs to be updated manually a bit (older versions)

gulp.task('pub2', () => {
  gulp.src('./Cashmaster.js')
    .pipe(replace(new RegExp('%%version%%', 'g'), version))
    .pipe(gfi({
      '%%README%%': 'tmp/script/README.md',
    }))
    .pipe(babel({
      presets: ['env'],
    }))
    .pipe(gulp.dest('./publish'))
    .pipe(gulp.dest(`./publish/${version}`));

  gulp.src('./prep/script.json')
    .pipe(replace(new RegExp('%%version%%', 'g'), version))
    .pipe(gfi({
      '%%README%%': 'tmp/package/README.md',
    }))
    .pipe(gulp.dest('./publish'));

  gulp.src('./publish/script.json')
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
});

gulp.task('pub3', () => {
  gulp.src('./publish/script.json')
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());

  gulp.src('./publish/*')
    .pipe(gulp.dest('../roll20-api-scripts/CashMaster/'));
  return del.sync('./tmp');
});

gulp.task('cleanup', () => {
  del.sync('./tmp');
});


gulp.task('cleanup2', () => {
  del.sync('./tmp');
  del.sync('./publish');
});
