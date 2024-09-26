#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const yargs = require('yargs');
const argv = yargs
    .option('name', {
        alias: 'n',
        description: "Bot folder's name",
        type: 'string',
        default: 'new_bot',
    })
    .option('path', {
        alias: 'p',
        description: 'Path where to create the project',
        type: 'string',
        default: process.cwd(),
    })
    .option('dblib', {
        alias: 'd',
        description: 'Database library to use',
        choices: ['mysql', 'none'],
        default: 'none',
    })
    .option('varenv', {
        alias: 'e',
        description: 'Include dotenv for environment variables',
        choices: ['dotenv', 'none'],
        default: 'none',
    })
    .help()
    .alias('help', 'h')
    .argv;
const createFolder = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`Folder created: ${folderPath}`);
    } else {
        console.log(`Folder already exist : ${folderPath}`);
    }
};
const createFile = (filePath, content) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
        console.log(`File Created: ${filePath}`);
    } else {
        console.log(`This file already exists: ${filePath}`);
    }
};
const rootDir = path.join(argv.path, argv.name);
createFolder(rootDir);
createFolder(path.join(rootDir, 'Events'));
createFolder(path.join(rootDir, 'Commands'));
const installDependencies = () => {
    console.log('Installing necessary dependencies...');
    const dependencies = ['discord.js'];
    if (argv.dblib === 'mysql') {
        dependencies.push('mysql');
    }
    if (argv.varenv === 'dotenv') {
        dependencies.push('dotenv');
    }
    execSync(`npm install ${dependencies.join(' ')}`, { cwd: rootDir, stdio: 'inherit' });
    console.log('Dependencies installed:', dependencies.join(', '));
};
let indexJsContent = `const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
`;
if (argv.varenv === 'dotenv') {
    indexJsContent = `require('dotenv').config();\n` + indexJsContent;
};
if (argv.dblib === 'mysql') {
    indexJsContent += `const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'database_name',
});
        
connection.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});
`;
}
indexJsContent += `
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildEmojisAndStickers],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file); const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command)
    } else {
        console.log("[WARNING] The command at " + filePath + " is missing a required data or execute property.")
    };
};
const eventsPath = path.join(__dirname, 'Events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file); const event = require(filePath);
    event.once?client.once(event.name, (...args) => event.execute(...args, client)):client.on(event.name, (...args) => event.execute(...args, client));
};
client.login('');
`;
createFile(path.join(rootDir, 'index.js'), indexJsContent);
const interactionCreateContent = `const { Events, EmbedBuilder } = require('discord.js');
const cooldown = {};
module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction, client) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !interaction.isChatInputCommand()) { return };
        if (cooldown[interaction.user.id] > Date.now()) { return interaction.reply({ content: 'Commands are subject to a 5 second cooldown ...', ephemeral: true }) }
        try {
            console.log(command + " will be executed")
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
            }
        } finally {
            cooldown[interaction.user.id] = Date.now() + 5000; setTimeout(() => { delete cooldown[interaction.user.id] }, 5000);
        }
    },
};
`;
createFile(path.join(rootDir, 'Events', 'InteractionCreate.js'), interactionCreateContent);
const helloCommandContent = `const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Answer with world!'),
    async execute(interaction) {
        await interaction.reply('world!');
    },
};
`;
createFile(path.join(rootDir, 'Commands', 'hello.js'), helloCommandContent);
installDependencies();
console.log("Bot's structure created successfully !");
