const express = require('express')
const http = require('http')
const path = require('path')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
// we don't need to create it if we're not passing to socket, but if we want to, we need to call it to enable it
const server = http.createServer(app) 
const io = socketio(server) // config socket to work with the server


// setup the port
const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public') 

// config the server
app.use(express.static(publicDirectoryPath))


// config index file to work with client that connect to it
io.on('connection', (socket) => {
    console.log('New WebSocket connection')


    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        // emtis welcome message to new joined user
        socket.emit('message', generateMessage('Admin', 'Welcome!'))

        // emits notification to all connected clients except particular user in that particular room
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        
        callback()

        // io.to.emit emits to everyone in particular room

    })

    // emits event to every single connection
    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id)

        const filter = new Filter()
        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed')
        }


        // emit user messages in particular room
        io.to(user.room).emit('message', generateMessage(user.username, msg))
        callback()
    })


    // emit send location to all connected clients in particular room
    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    // emit message when particular user leaves
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})


// start the server 
server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
}) 