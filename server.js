const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {useMongoClient: true} )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


const User = require(__dirname + '/user.js');

// Rutas
app.post('/api/exercise/new-user', (req, res, next) => {
  // Si no existe, crear un nuevo usuario en la base de datos.
  // ¿Cómo obtiene el nombre de usuario del formulario? ¿Cómo viene codificado?
  // En req.body:
  // req.body.username
  const username = req.body.username;
  if(username){
    const newUser = {username: username, count: 0, log: []};
    User.find(newUser, (error, data) => {
      if (error) return next(error);
      if (data.length === 0) {
        // crear un nuevo usuario
        User.create(newUser, (error, user) => {
          if (error) return next(error);
          res.json({username: user.username, id: user._id});
        });
      } else {
        // el usuario ya existe
        res.send("That username is already taken.");
      }
    })
  } else {
    res.send("You need to provide a username.");
  }
});

app.post('/api/exercise/add', (req, res, next) => {
  // Si el userId es válido, si corresponde a un usuario en la base de datos, entonces
  // actualizar los datos sobre descripción, duración y fecha tal como vienen en req del formulario.
  
  // req.body.userId
  // req.body.description
  // req.body.duration
  // req.body.date
  
  // PARA HACER: verificar que los datos ingresados están bien y son seguros
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  // console.error('User id: ' + userId);
  const requiredFieldsCompleted = userId && description && duration;
  if(requiredFieldsCompleted){
    User.findById(userId, (error, user) => {
      if(error) return next(error);
      // ¿qué pasa si no lo encuentra? ¡Hace falta chequear si encontró un usuario!
      // si está el usuario y los datos tienen el tipo que corresponde, actualizar el registro
      if(user){    
      const date = (req.body.date) ? new Date(req.body.date) : new Date();
      // console.error("type of Date.now(): " + typeof Date.now()); es de type number y no date object
      user.count = user.count + 1;
      const newExercise = {description: description, duration: duration, date: date};
      user.log.push(newExercise);
    
      user.save((error, user) => {
        if(error) return next(error);
        // const dataToShow = {username: user.username, _id: user._id, ...newExercise };
        const dataToShow = {username: user.username, _id: user._id, description: description, duration: duration, date: date.toDateString() };
        res.json(dataToShow);
      });
      } else {
        next();
      }
    });
  } else {
    // Para hacer: adecuar los mensajes según sea el campo que falte completar.
    let message = "Please complete all the required fields.";
    res.send(message);
  }
});

app.get('/api/exercise/log', (req, res, next) =>{
  // revisar los datos que vienen en:
  // req.query.userId
  // req.query.from
  // req.query.to
  // req.query.limit
  
  // si hay un userId válido, y si hay algo más y corresponde al tipo de datos que debe ser
  // entonces enviar como respuesta un json con los datos de los ejercicios
  
  const userId = req.query.userId;
  //console.error('User id: ' + userId);
  if(userId){
    let from = req.query.from;
    let to = req.query.to;
    let limit = req.query.limit; // ¿Qué pasa si no le paso limit?: no pone límites.
    
    // ver cómo evitar la repetición del chequeo de from y to acá y un poco más adelante.
    
    // ¿Qué pasa con el filtro de populate si no se pasó from ni to? Tira el error de que from (o to) no está(n) definido(s)
    
     
    const matchOptions = {};
    if (from && to) {
      from = new Date(from);
      to = new Date(to);
      matchOptions.date = {$gte: from, $lte: to}
    } else if (from) {
      from = new Date(from);
      matchOptions.date = {$gte: from};
    } else if (to) {
      to = new Date(to);
      matchOptions.date = {$lte: to};
    }
    
    const limitOptions = {};
    if (limit) limitOptions.limit = limit;
    
    User.findById(userId)
      .populate({path: 'log', match: matchOptions, select : '-_id', options: limitOptions})
      .exec((error, user) => {
      // acá hay que procesar user.log, una idea a mejorar: ordenarlos por fecha, ir de a uno desde el primero hasta limit menos 1 viendo si la fecha está entre from y to
      // otra idea, hacer un loop que se va a cortar una vez que se llegue a limit o no haya más elementos que mirar en log, y cada vez que se encuentra un elemento que está entre from y to se suma uno al contador.
      
      /* 
      No entiendo cómo funciona match. ¿Para qué está? porque la verdad, no filtra.
      Y, de verdad, ¿qué hace populate?
      */
      
      if(error) return next(error);
      if (user){
        //console.error(user.log);
        
        const dataToShow = {id: user._id, username: user.username, count: user.count};
        
        // console.error('from: ' + from);
        // console.error('type of from: ' + typeof from);
        
        if (from) dataToShow.from = from.toDateString();
        if (to) dataToShow.to = to.toDateString();
        
        // filtro los elementos de log, ya que el match no produjo ningún efecto que yo perciba
        dataToShow.log = user.log.filter((ej) => {
          if (from && to) {
            return ej.date >= from && ej.date <= to;
          } else if (from) {
            return ej.date >= from;
         } else if (to) {
           return ej.date <= to;
         }    
        });
        res.json(dataToShow);
      } else {
        next();
      }
    });
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})