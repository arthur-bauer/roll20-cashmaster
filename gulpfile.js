/*
	
npm install gulp --save-dev
npm install gulp-string-replace --save-dev
npm install gulp-file-insert --save-dev
npm install gulp-markdown --save-dev
npm install gulp-bump --save-dev
npm install del --save-dev
npm install --save-dev gulp-jsonlint
	
*/	

var gulp = require('gulp');
var replace = require('gulp-string-replace');
var gfi = require("gulp-file-insert");
var markdown = require('gulp-markdown');
var del = require('del');
var bump = require('gulp-bump');
var jsonlint = require("gulp-jsonlint");

var p = require('./package.json')
var version = p.version.replace('v','');



// ### Version number bump routines
//
// Basic usage:
// Will patch the version
gulp.task('bump', function(){
  gulp.src('./*.json')
  .pipe(bump())
  .pipe(gulp.dest('./'));
});

gulp.task('bump-minor', function(){
  gulp.src('./*.json')
  .pipe(bump({type:'minor'}))
  .pipe(gulp.dest('./'));
});

gulp.task('bump-major', function(){
  gulp.src('./*.json')
  .pipe(bump({type:'major'}))
  .pipe(gulp.dest('./'));
});

gulp.task('bump-pre', function(){
  gulp.src('./*.json')
  .pipe(bump({type:'prerelease'}))
  .pipe(gulp.dest('./'));
});


// prepare the three readme versions
// - a html version for inline help
// - a md with converted linebreaks for the json
// - and the clean md for the publish folder

gulp.task('readme1',function()
	{
    gulp.src('./README.md')
        .pipe(markdown())
	    .pipe(replace(new RegExp('\n', 'g'), ''))
	    .pipe(replace(new RegExp('"', 'g'), '\''))
        .pipe(gulp.dest('./tmp/script'))
	
	
    gulp.src('./README.md')
	    .pipe(replace(new RegExp('\n', 'g'), '\\r'))
	    .pipe(replace(new RegExp('"', 'g'), '\''))
        .pipe(gulp.dest('./tmp/package'))

    gulp.src('./README.md')
        .pipe(gulp.dest('./publish'))
	
	
	gulp.src("./prep/script.json")
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());


	});

// Then, replace vn and readme content in Cashmaster.js
// and script.json and write everything to the publish folder
// The package.json still needs to be updated manually a bit (older versions)

gulp.task('readme2',function()
	{
	gulp.src('./Cashmaster.js')
    .pipe(replace(new RegExp('%%version%%', 'g'), version))
	.pipe(gfi({
	"%%README%%": "tmp/script/README.md",
	}))  
	.pipe(gulp.dest('./publish'))
	.pipe(gulp.dest('./publish/'+version));

	gulp.src('./prep/script.json')
    .pipe(replace(new RegExp('%%version%%', 'g'), version))
	.pipe(gfi({
	"%%README%%": "tmp/package/README.md",
	}))  
	.pipe(gulp.dest('./publish'))

	gulp.src("./publish/script.json")
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());

	
	});


gulp.task('readme3', function() {

	gulp.src("./publish/script.json")
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());

  gulp.src("./publish/*")
 	.pipe(gulp.dest("../roll20-api-scripts/CashMaster/"));
   return del.sync('./tmp');
});


gulp.task('cleanup', function() {
  return del.sync('./tmp');
});