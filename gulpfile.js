/*
yarn
*/

const gulp = require('gulp');
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
gulp.task('bump', () => {
  gulp.src('./*.json')
    .pipe(bump())
    .pipe(gulp.dest('./'));
});

gulp.task('bump-minor', () => {
  gulp.src('./*.json')
    .pipe(bump({
      type: 'minor',
    }))
    .pipe(gulp.dest('./'));
});

gulp.task('bump-major', () => {
  gulp.src('./*.json')
    .pipe(bump({
      type: 'major',
    }))
    .pipe(gulp.dest('./'));
});

gulp.task('bump-pre', () => {
  gulp.src('./*.json')
    .pipe(bump({
      type: 'prerelease',
    }))
    .pipe(gulp.dest('./'));
});

// prepare the three readme versions
// - a html version for inline help
// - a md with converted linebreaks for the json
// - and the clean md for the publish folder

gulp.task('pub1', () => {
  gulp.src('./README.md')
    .pipe(markdown())
    .pipe(replace(/\\n/g), '\\r')
    .pipe(replace(/"/g), '\'')
    .pipe(gulp.dest('./tmp/script'));

  gulp.src('./README.md')
    .pipe(replace(/\\n/g), '\\r')
    .pipe(replace(/"/g), '\'')
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

gulp.task('cleanup2', () => {
  del.sync('./tmp');
  del.sync('./publish');
});
