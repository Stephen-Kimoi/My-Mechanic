equire('dotenv').config(); // load configs from .env

const log = require('signale');

const { Elarian } = require('elarian');

let client;

const smsChannel = {
    number: process.env.SMS_SHORT_CODE,
    channel: 'sms',
};

const voiceChannel = {
    number: process.env.VOICE_NUMBER,
    channel: 'voice',
};

const mpesaChannel = {
    number: process.env.MPESA_PAYBILL,
    channel: 'cellular',
};

const purseId = process.env.PURSE_ID;

const approveLoan = async (customer, amount) => {
    log.info(`Processing loan for ${customer.customerNumber.number}`);

    const { name } = await customer.getMetadata();
    const repaymentDate = (Date.now() + 60000);
    const res = await client.initiatePayment({
        purseId,
    }, {
        channelNumber: mpesaChannel,
        customerNumber: customer.customerNumber,
    }, {
        amount,
        currencyCode: 'KES',
    });
    if (!['success', 'queued', 'pending_confirmation', 'pending_validation'].includes(res.status)) {
        log.error(`Failed to send KES ${amount} to ${customer.customerNumber.number} --> ${res.status}: `, res.description);
        return;
    }
    await customer.updateMetadata({
        name,
        balance: amount,
    });
    await customer.sendMessage(
        smsChannel, {
            body: {
                text: `Congratulations ${name}!\nYour loan of KES ${amount} has been approved!\nYou are expected to pay it back by ${new Date(repaymentDate)}`,
            },
        },
    );
    await customer.addReminder({
        key: 'moni',
        remindAt: repaymentDate / 1000,
        payload: '',
        interval: 60
    });
};

const processPayment = async (payment, customer) => {
    log.info(`Processing payment from ${customer.customerNumber.number}`);
    const { value: { amount } } = payment;
    const {
        name,
        balance,
    } = await customer.getMetadata();
    const newBalance = balance - amount;
    await customer.updateMetadata({
        name,
        balance: newBalance,
    });
    if (newBalance <= 0) {
        await customer.cancelReminder('moni');
        await customer.sendMessage(
            smsChannel, {
                body: {
                    text: `Thank you for your payment ${name}, your loan has been fully repaid!!`,
                },
            },
        );
        await customer.deleteMetadata(['name', 'strike', 'balance', 'screen']); // clear state
        await customer.deleteAppData();
    } else {
        await customer.sendMessage(
            smsChannel, {
                body: {
                    text: `Hey ${name}!\nThank you for your payment, but you still owe me KES ${newBalance}`,
                },
            },
        );
    }
};

const processReminder = async (reminder, customer) => {
    try {
        const customerData = await customer.getMetadata();
        log.info(`Processing reminder for ${customer.customerNumber.number}`);
        const {
            name,
            balance,
        } = customerData;
        const {
            strike = 1,
        } = customerData;
        if (strike === 1) {
            await customer.sendMessage(smsChannel, {
                body: {
                    text: `Hello ${name}, this is a friendly reminder to pay back my KES ${balance}`,
                },
            });
        } else if (strike === 2) {
            await customer.sendMessage(smsChannel, {
                body: {
                    text: `Hey ${name}, you still need to pay back my KES ${balance}`,
                },
            });
        } else {
            await customer.sendMessage(voiceChannel, {
                body: {
                    voice: [
                        {
                            say: {
                                text: `Yo ${name}!!!! you need to pay back my KES ${balance}`,
                                voice: 'male',
                            },
                        },
                    ],
                },
            });
        }
        await customer.updateMetadata({
            ...customerData,
            strike: strike + 1,
        });
    } catch (error) {
        log.error('Reminder Error: ', error);
    }
};

const processUssd = async (notification, customer, appData, callback) => {
    try {
        log.info(`Processing USSD from ${customer.customerNumber.number}`);
        const input = notification.input.text;

        let screen = 'home';
        if (appData) {
            screen = appData.screen;
        }

        const customerData = await customer.getMetadata();
        let {
            name,
            balance = 0,
        } = customerData;
        const menu = {
            text: null,
            isTerminal: false,
        };
        let nextScreen = screen;
        if (screen === 'home' && input !== '') {
            if (input === '1') {
                nextScreen = 'request-name';
            } else if (input === '2') {
                nextScreen = 'quit';
            }
        }
        if (screen === 'home' && input === '') {
            if (name) {
                nextScreen = 'info';
            }
        }
        
        switch (nextScreen) {
        case 'quit':
            menu.text = 'Happy Coding!';
            menu.isTerminal = true;
            nextScreen = 'home';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        
        // REPAIR SERVICES CODE:
        case 'repair-services':
            menu.text = `The following are the available services \n 1.Auto servicing \n 2.Diagnostics \n 3.Body repair \n 4.Paint services \n 0.back \n 00.home`;
            menu.isTerminal = true;
            if (input === '1') {
               nextScreen = 'auto-servicing'
            } else if (input === '2') {
                nextScreen = 'diagnostics' 
            } else if (input === '3') {
                nextScreen = 'body-repair'
            } else if (input === '4') {
                nextScreen = 'paint-services'
            } else if (input === '0') {
                nextScreen = previousScreen; 
            } else if (input === '00') {
                nextScreen = homeScreen; 
            }
        
            callback(menu, {
                screen: nextScreen,
            });
            break;
        // Auto servicing 
        case 'auto-servicing':
            menu.text = 'Which type of servicing would you like \n 1.interim \n 2.full \n 3.major'; 
            if (input === '1') {
                nextScreen = 'interim'
            } else if (input === '2') {
                nextScreen = 'full'
            } else if (input === '3') {
                nextScreen = 'major'
            }
    
            callback(menu, {
                screen: nextScreen,
            });
            break;
        // The types of auto-servicing services 
        case 'interim':
            menu.text = `In which county are you located?`;
            nextScreen = 'get-county';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        case 'full':
            menu.text = `In which county are you located?`;
            menu.isTerminal = true;
            nextScreen = 'get-county';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        case 'major':
            menu.text = `In which county are you located?`;
            menu.isTerminal = true;
            nextScreen = 'get-county';
            callback(menu, {
                screen: nextScreen,
            });
            break;
        
        // Diagnostics 
        case 'diagnostics': 
            menu.text = 'Which type of diagnostics would you like \n 1.interim \n 2.full \n 3.major'; 
            menu.isTerminal = true; 
            if (input === '1') {
                nextScreen = 'interim'
            } else if (input === '2') {
                nextScreen = 'full'
            } else if (input === '3') {
                nextScreen = 'major'
            }
            callback(menu, {
                screen: nextScreen, 
            })
            break; 
        
        // Body repair 
        case 'body-repair': 
            menu.text = 'Which type of body repair would you like? \n 1.Full body repair \n 2.Specific parts repired'; 
            menu.isTerminal = true; 
            if (input === '1') {
                nextScreen = 'full-body-repair'
            } else if (input === '2') { 
                nextScreen = 'specific-parts-repair'
            }
            callback(menu, {
                screen: nextScreen, 
            }); 
            break; 
        // Types of body repair 
        case 'full-body-repair': 
            menu.text = 'Where are you located?'; 
            menu.isTerminal = true; 
            nextScreen = 'get-county'; 
            callback(menu, {
                screen: nextScreen, 
            }); 
            break; 
        case 'specifc-parts-repaired': 
            menu.text = 'Which type of parts would you like repaired \n 1.Headlights \n 2.Taillights \n 3.Turn signals \n 4.Hood/Engine'; 
            menu.isTerminal = true; 
            if (input === '1') {
                nextScreen = 'get-mechanic'
            } else if(input === '2') {
                nextScreen = 'get-mechanic'
            } else if (input === '3') {
                nextScreen = 'get-mechanic'
            } else if (input === '4') {
                nextScreen = 'get-mechanic'
            } 
            callback(menu, {
                screen: nextScreen, 
            }); 
            break;
            
        // END OF REPAIR SERVICES CODE
        default:
            menu.text = 'Welcome to MoniMoni!\n1. Apply for loan\n2. Quit';
            menu.isTerminal = false;
            callback(menu, {
                screen: nextScreen,
            });
            break;
        }
        await customer.updateMetadata({
            name,
            balance,
        });
    } catch (error) {
        log.error('USSD Error: ', error);
    }
};

const start = () => {
    client = new Elarian({
        appId: process.env.APP_ID,
        orgId: process.env.ORG_ID,
        apiKey: process.env.API_KEY,
    });

    client.on('ussdSession', processUssd);

    client.on('reminder', processReminder);

    client.on('receivedPayment', processPayment);

    client
        .on('error', (error) => {
            log.warn(`${error.message || error} Attempting to reconnect...`);
            client.connect();
        })
        .on('connected', () => {
            log.success(`App is connected, waiting for customers on ${process.env.USSD_CODE}`);
        })
        .connect();
};
start();