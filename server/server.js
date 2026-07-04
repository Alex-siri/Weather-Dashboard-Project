const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3002;

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors());
app.get('/', async (req, res) => {
    const url = 'https://api.openweathermap.org/data/2.5/weather';
    const API_KEY = "aef04602884d32a19552ca423ca6e7bd"
    const params = req.query;
    const city = params.city;
    console.log(req.query);
    try {
        if (!city) {
            throw new Error('City parameter is required');  
        }else{
            const response = await axios.get(url, {
      params: {
        q: city,
        units: 'metric',
        appid: API_KEY
      }
    });
    console.log(response);
    res.json(response.data);

        }
}
catch (error) {
    res.status(400).json({ error: error.message });
}
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:3002`);
});