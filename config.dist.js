module.exports = {
    port: 3000,
    credentials: {
        web: {
            token: 'AUTH_TOKEN',
        }
    },
    commandToRestart: "sh ./minecraft-server.sh restart",
    paths: {
        deploy: {
            client: "./deploy/client",
            server: "./deploy/server"
        },
        extracts: {
            client: './extracts/client',
            server: "./extracts/server"
        },
        uploads: './uploads',
        database: "./src"
    },
    pack: {
        name: "My pack",
        title: "My pack"
    }
};