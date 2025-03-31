interface Environment {
    PORT: number;
}

const env: Environment = {
    PORT: parseInt(process.env.PORT ?? "3001", 10),
};

export default env;
