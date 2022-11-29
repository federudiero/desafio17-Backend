const Product = require('../DAO/product.js');

(_ => {
    let factory = new Product()
    let types = ['Tipo 1', 'Tipo 2' , 'Tipo 3'];
    let productos = []

    for (let i = 0; i < 100; i++) {
        productos.push(factory.add({type: types[Math.floor(Math.random(2) * 2)]}))
    }

    productos.forEach(e => {
        console.log('Producto ' + productos.type)
    })
})()
