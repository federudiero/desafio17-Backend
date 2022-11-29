const express = require("express");
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const session = require('express-session');
require('dotenv').config();
const MongoStore = require('connect-mongo');
const { normalize, schema } = require('normalizr');
const productRoutes = require("./src/routes/products.js");
const frontRoutes = require('./src/routes/front.js');
const ArchivoDB = require('./src/DB/archivoDb.js');
const archivoDB = new ArchivoDB();
const UsuarioDB = require('./src/DB/usuarioDb.js');
const usuarioDB = new UsuarioDB();
const _ = require('././src/factory/index.js')
// const { fork } = require('child_process');
const compression = require('compression');
const { logger, loggerWarn, loggerError } = require('./src/logger.js')
const isAuth = require('./src/middleware/auth.js')
/* ------------------ PASSPORT -------------------- */
const passport = require('passport');

/* --------------------- SERVER --------------------------- */

const app = express();
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);

const advancedOptions = { useNewUrlParser: true, useUnifiedTopology: true };

const admin = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;

const url = 'mongodb+srv://LucasPonti:36345079@cluster0.z9a2mkz.mongodb.net/sesiones?retryWrites=true&w=majority';

/* --------------------- MIDDLEWARE --------------------------- */
var hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: 'main.hbs'
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("./public"));
app.use(cookieParser());
app.use(session({
  store: MongoStore.create({ 
    mongoUrl: url,
    ttl: 10 * 60, // = 10 min. Default
    mongoOptions: advancedOptions }),
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 }
}));
app.use(passport.initialize());
app.use(passport.session());
/* --------------------- ROUTES --------------------------- */

app.use("/productos", isAuth, productRoutes);
app.use("/productos/nuevo-producto", isAuth, frontRoutes);

/* --------- LOGOUT ---------- */
app.get('/logout', (req, res) => {
  req.logout();
  setTimeout(function(){ 
    res.redirect('http://localhost:8080/login');
  }, 2000);
})


/* --------- LOGIN ---------- */
app.get('/login', (req, res) => {
  res.render('login')
})
app.get('/faillogin', (req, res) => {
  res.render('login-error', {});
})

/* --------- INICIO ---------- */
app.get('/', isAuth, (req, res) => {
  res.redirect('/productos/vista')
})
app.get('/chat', isAuth, (req, res) => {
  if (!req.user.contador){
    req.user.contador = 0
  }
  res.sendFile('./src/index.html', { root:__dirname })
});

/* --------- INFO ---------- */
app.get('/info', compression(), (req, res) => {
  try {
    console.log('Console log INFO')
    logger.info('Mensaje info -----------------> OK');
    loggerWarn.warn('Mensaje warn -----------------> OK')
    const numCPUs = require('os').cpus().length
    res.render('info', {
      user: req.user,
      info: process,
      argv: process.argv,
      memoryUsage: process.memoryUsage(),
      numCPUs: numCPUs,
    });
  } catch(err) {
    loggerWarn.warn('Error message: ' + err)
    logger.info('Error message: ' + err);
    loggerError.error('Error message: ' + err);
  }
})
/* --------- RANDOMS ---------- */
app.get('/randoms', (req, res) => {
  const { cant } = req.params;
  console.log(cant)
  let { url } = req;

  if (url == `/randoms?cant=${cant}`) {
    const computo = fork('./computo.js');
    computo.send('start');

    const array = [];
    if (cant == undefined) {
      for (let i = 0; i < 100000000; i++) {
        const numero_random = computo;
        array.push(numero_random);
      }
      console.log(array)

      res.render('randoms', {
        active: 'randoms',
        randoms: array,
        cantidad: cant,
      })

    }else if (url == `/randoms?cant=${cant}`) {
      for (let i = 0; i < cant; i++) {
        const numero_random = computo;
        array.push(numero_random);
      };

      res.render('randoms', {
        active: 'randoms',
        randoms: array,
        cantidad: cant,
      })
    }
  }
})

const user = new schema.Entity("users");
const text = new schema.Entity("text");
const mensaje = new schema.Entity("mensaje", {
  author: user,
  text: text,
});
const mensajes = new schema.Entity("mensajes", {
  mensajes: [mensaje],
});

io.on('connection', async (socket) => {
  console.log('Cliente conectado');
  //lista desde base de datos y desnomalizr
  let listaMensajes = await archivoDB.listar();

  socket.emit('messages', listaMensajes)

  socket.on('new-message', async (data) => {
    // console.log("/* -------------- DATA ------------- */");
    // console.log(data);
    const nuevoMensaje = {
      id: listaMensajes.length+1,
      author: {
        id: data.author.id,
        nombre: data.author.nombre,
        apellido: data.author.apellido,
        edad: data.author.edad,
        alias: data.author.alias,
        avatar: data.author.avatar
      },
      text: {
        id: listaMensajes.length+1,
        text: data.text,
      },
      date: new Date().toLocaleString()
    };
    // console.log(nuevoMensaje);
    listaMensajes.push(nuevoMensaje)
    // console.log(listaMensajes);
    const originalData = {
      id: "1",
      mensajes: listaMensajes,
    };
    const normalizedData = normalize(originalData, mensajes);
    await archivoDB.insertar(normalizedData);
    io.sockets.emit('messages', listaMensajes)
  })
})

process.on('exit', function (code) {
  console.log('Exit code:'+ code);
});

const server = httpServer.listen(8080, () => {
  logger.info('El servidor esta corriendo en el puerto: ' + server.address().port);
});
server.on('error', err => {
  logger.info('Error message: ' + err); 
  loggerError.error('Error message: ' + err);
});