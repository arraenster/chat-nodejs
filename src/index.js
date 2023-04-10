const path = require('path')
const http = require('http')
const express = require('express')
const soketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = soketio(server)

const port = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, '../public')))

app.get('', (req, res) => {
    res.render('index', {
        title: "Chat App"
    })
})

io.on('connection', (socket) => {
    console.log('New websocket connection')

    socket.on('join', ({username, room}, callback) => {

        const {error, user } = addUser({
            id: socket.id,
            username,
            room
        })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('SYSTEM', 'Welcome')) //sends to only current client
        socket.broadcast.to(user.room).emit('message', generateMessage(`${user.username} joins ${user.room}`)) //sends to all clients but current client
        
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)

        if (!user) {
            callback('Can not find connected user')
        }

        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message)) //sends to all clients

        callback('Delivered!')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('SYSTEM', `User ${user.username} is disconnected from ${user.room}`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id)
        
        if (!user) {
            callback('Can not find connected user')
        }

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, 'https://google.com/maps?q=' + location.lat + ',' + location.lon))

        callback()
    })
})



server.listen(port, () => {
    console.log('Server runs. Emperor protects.')
})