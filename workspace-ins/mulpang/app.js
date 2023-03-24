var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var nocache = require('nocache');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 미들웨어
// 1. 필요한 작업을 수행한다.
// 2. 둘중 하나의 작업으로 종료한다.
//    1) 다음 미들웨어를 호출한다.
//    2) 클라이언트에 응답메세지를 전송한다.
// app.use(function(req, res, next){
//   console.log('첫 미들웨어');
//   console.log('req.body', req.body);
//   console.log('req.cookies', req.cookies);
//   console.log('req.session', req.session);
//   next();
// });

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(/^((?!\/couponQuantity).)*$/, session({
  cookie: {maxAge: 1000*60*30},
  secret: 'some seed text',
  rolling: true,
  resave: false,
  saveUninitialized: false
}), function(req, res, next){
  res.locals.user = req.session.user;
  next();
});

// app.use(function(req, res, next){
//   console.log('두번째 미들웨어');
//   console.log('req.body', req.body);
//   console.log('req.cookies', req.cookies);
//   console.log('req.session', req.session);
//   next();
// });

app.use(nocache());

app.use(logger('dev'));
app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404, req.url + ' Not Found'));
});

// error handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
