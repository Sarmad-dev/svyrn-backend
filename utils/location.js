export const getLocationName = async (latitude, longitude) => {
    const apiKey = process.env.OPENCAGE_API_KEY;
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`
    );

    console.log("LAT: ", latitude)
    console.log("LONG: ", longitude)
  
    const data = await response.json();

    console.log("DATA: ", data)
  
    if (data.results.length > 0) {
      const location = data.results[0].formatted;
      return location;
    } else {
      throw new Error("No location found");
    }
  };