require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

// Environment Variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const WHITELIST_ROLE_ID = process.env.WHITELIST_ROLE_ID;
const APPROVED_ROLE_ID = process.env.APPROVED_ROLE_ID;
const REJECTED_ROLE_ID = process.env.REJECTED_ROLE_ID;
const BANNED_ROLE_ID = process.env.BANNED_ROLE_ID;

// Website API URL
const API_URL = process.env.WEBSITE_API_URL || 'http://localhost:3000';
const API_SECRET = process.env.BOT_API_SECRET || 'electro_bot_secret_123';

// Initialize Client with necessary Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Define Slash Command
const commands = [
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Whitelist status and claim your role.')
].map(command => command.toJSON());

// Register Slash Command
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// Bot Ready Event
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    console.log('Bot is ready to verify users.');
});

// Handle Slash Command Interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'verify') {
        // Defer reply since the API call might take a moment
        await interaction.deferReply({ ephemeral: true });

        const discordId = interaction.user.id;

        try {
            // 1. Make API Request to the Website
            const response = await axios.get(`${API_URL}/api/bot/check-whitelist/${discordId}`, {
                headers: {
                    'Authorization': `Bearer ${API_SECRET}`
                }
            });

            const data = response.data;

            if (data.whitelisted) {
                // 2. User is Approved, check Bot Permissions and grant role
                const member = await interaction.guild.members.fetch(discordId);
                const whitelistRole = interaction.guild.roles.cache.get(WHITELIST_ROLE_ID);
                const approvedRole = interaction.guild.roles.cache.get(APPROVED_ROLE_ID);

                if (!whitelistRole && !approvedRole) {
                    return interaction.editReply('❌ Roles not found in the server. Please contact an admin.');
                }

                // Security Check: Does the bot have permission?
                if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                    return interaction.editReply('❌ I do not have sufficient permissions to assign roles. Make sure my role has "Manage Roles" permission!');
                }

                // Assign Roles
                let rolesAdded = false;
                
                if (whitelistRole && interaction.guild.members.me.roles.highest.position > whitelistRole.position) {
                    if (!member.roles.cache.has(whitelistRole.id)) {
                        await member.roles.add(whitelistRole);
                        rolesAdded = true;
                    }
                }
                
                if (approvedRole && interaction.guild.members.me.roles.highest.position > approvedRole.position) {
                    if (!member.roles.cache.has(approvedRole.id)) {
                        await member.roles.add(approvedRole);
                        rolesAdded = true;
                    }
                }

                if (!rolesAdded) {
                    return interaction.editReply('✅ You already have the Whitelist/Approved roles!');
                }

                return interaction.editReply('🎉 **Verification Successful!** You have been granted the Whitelist role(s). Welcome to Electro Server!');

            } else if (data.status === 'rejected') {
                const member = await interaction.guild.members.fetch(discordId);
                const role = interaction.guild.roles.cache.get(REJECTED_ROLE_ID);
                if (role && interaction.guild.members.me.permissions.has('ManageRoles') && interaction.guild.members.me.roles.highest.position > role.position) {
                    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
                }
                return interaction.editReply(`⚠️ **Verification Failed.** Your application status is: \`Rejected\`.\nIf you believe this is an error, please check the website.`);
            } else if (data.status === 'banned') {
                const member = await interaction.guild.members.fetch(discordId);
                const role = interaction.guild.roles.cache.get(BANNED_ROLE_ID);
                if (role && interaction.guild.members.me.permissions.has('ManageRoles') && interaction.guild.members.me.roles.highest.position > role.position) {
                    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
                }
                return interaction.editReply(`⛔ **Verification Failed.** You have been banned from applying.`);
            } else {
                // Pending
                return interaction.editReply(`⏳ **Verification Failed.** Your application status is: \`Pending Review\`.\nIf you believe this is an error, please check the website.`);
            }

        } catch (error) {
            // 3. Error Handling (API Down, Not Found, etc.)
            if (error.response && error.response.status === 404) {
                return interaction.editReply('❌ **No application found.** You need to apply on the website first!');
            }
            
            console.error('API Error:', error.message);
            return interaction.editReply('🚨 **Error connecting to the database.** The website API might be down. Please try again later or contact an admin.');
        }
    }
});

// Start the Bot
client.login(TOKEN);
