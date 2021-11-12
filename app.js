require('dotenv').config(); 

const log = require('signale'); 

const { Elarian } = require('elarian'); 


let client; 

const makeOrder = async (customer) => {
    log.info(`Processing order from ${customer.customerNumber.number}`); 
    const salesPerson = new client.Customer({
        provider: 'cellular', 
        number: '+254791496764'
    })

    await salesPerson.sendMessage(
        smsChannel, 
        { body: {
            text: `The following items have been ordered: ${items}`
        }}, 
    ); 
    await customer.deleteMetadata(['items','screen']); 
    await customer.deleteAppData(); 
} 

const processUssd = async (notification, appData, callBack, customer) => {
    try {
        console.log(`Processing USSD from ${customer.customerNumber.number}`); 
        const input = notification.input.text; 

        let screen = 'home'; 

        if(appData) {
            screen = appData.screen; 
        }

        const customerData = await customer.getMetaData(); 

        let {items = ""} = customerData; 

        const menu = {
            text: null, 
            isTerminal: false, 
        }; 

        let nextScreen = screen;  

        if(screen === 'home' && input !== '') {
           if(input === '1') {
               nextScreen = 'set-location'; 
           } else if (input === '2'){
               nextScreen = 'quit'; 
           }
        }

        if(screen === 'home' && input === '') {

        }  
        switch(nextScreen) {
            case 'quit': 
                menu.text = 'Thank you for inquiring at our services', 
                menu.isTerminal = true; 
                nextScreen = 'home'; 
                callBack(menu, { screen: nextScreen }); 
            break; 
            case 'set-location': 
                menu.text = '1. Nairobi \n 2. Kisumu '
                nextScreen = 'display-items'; 
                callBack(menu, { screen: nextScreen }); 
            case 'display-items': 
                items = input; 
                items = items.replace (" ", "\n"), 
                menu.text = `Okay you collected these items ${items}`; 
                nextScreen = 'finish-order'; 
                callBack(menu, {screen: next-screen }); 
            break; 
            case 'finish-order': 
                acceptance = input; 
                if (acceptance == 'Yes' || acceptance == 'yes' ) {
                    menu.text = `Thanks for shopping with us`
                } else {
                    menu.text = `Thanks for using the service`
                } 
                menu.isTerminal = true; 
                nextScreen = 'home'; 
                callBack(menu, { screen: nextScreen})

                await makeOrder(customer);  
            break; 
            case 'home': 
            default: 
                menu.text = 'Welcome to my mechanic' 
                menu.isTerminal = false; 
                callBack(menu, {screen: nextScreen}); 
            break; 
        }  
            await customer.updateMetaData({ items, }); 
    } catch (error){
         console.log(error);
    } 
    const start = () => {
        client = new Elarian({
            appId: process.env.APP_ID,
            orgId: process.env.ORG_ID,
            apiKey: process.env.API_KEY,
        });
    
        client.on('ussdSession', processUssd)

        client
            .on('error', (error) => {
                console.log(`${error.message || error} Attempting to reconnect...`);
                client.connect();
            })
            .on('connected', () => {
                console.log(`App is connected, waiting for customers on ${process.env.USSD_CODE}`);
            })
            .connect();
    }; 
    start()
}; 
