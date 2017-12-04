#!/opt/omni/bin/node

var moment = require('moment-timezone'),
    https = require('https'),
    stop_after_one = true;

if(process.argv.length < 3 || process.argv.length > 4) {
  console.error("cmd <config> [<date>]");
  process.exit(1);
}
var config = JSON.parse(fs.readFileSync(process.argv[2]));
if(!config.station) {
  console.error("Invalid json config");
  process.exit(1);
}

var trap_uuid = config.trapuuid,
    trap_secret = config.secret,
    time_zone = config.timezone,
    station = config.station,
    now = moment().tz(time_zone),
    year = now.format('YYYY'),
    month = now.format('M'),
    day = now.format('D');

if(process.argv.length == 4) {
    now = new Date(process.argv[3]);
    year = now.getUTCFullYear();
    month = now.getUTCMonth()+1;
    day = now.getUTCDate();
    stop_after_one = false;
}
var ca =
"-----BEGIN CERTIFICATE-----\n" +
"MIID4zCCA0ygAwIBAgIJAMelf8skwVWPMA0GCSqGSIb3DQEBBQUAMIGoMQswCQYD\n" +
"VQQGEwJVUzERMA8GA1UECBMITWFyeWxhbmQxETAPBgNVBAcTCENvbHVtYmlhMRcw\n" +
"FQYDVQQKEw5DaXJjb251cywgSW5jLjERMA8GA1UECxMIQ2lyY29udXMxJzAlBgNV\n" +
"BAMTHkNpcmNvbnVzIENlcnRpZmljYXRlIEF1dGhvcml0eTEeMBwGCSqGSIb3DQEJ\n" +
"ARYPY2FAY2lyY29udXMubmV0MB4XDTA5MTIyMzE5MTcwNloXDTE5MTIyMTE5MTcw\n" +
"NlowgagxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMI\n" +
"Q29sdW1iaWExFzAVBgNVBAoTDkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJj\n" +
"b251czEnMCUGA1UEAxMeQ2lyY29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4w\n" +
"HAYJKoZIhvcNAQkBFg9jYUBjaXJjb251cy5uZXQwgZ8wDQYJKoZIhvcNAQEBBQAD\n" +
"gY0AMIGJAoGBAKz2X0/0vJJ4ad1roehFyxUXHdkjJA9msEKwT2ojummdUB3kK5z6\n" +
"PDzDL9/c65eFYWqrQWVWZSLQK1D+v9xJThCe93v6QkSJa7GZkCq9dxClXVtBmZH3\n" +
"hNIZZKVC6JMA9dpRjBmlFgNuIdN7q5aJsv8VZHH+QrAyr9aQmhDJAmk1AgMBAAGj\n" +
"ggERMIIBDTAdBgNVHQ4EFgQUyNTsgZHSkhhDJ5i+6IFlPzKYxsUwgd0GA1UdIwSB\n" +
"1TCB0oAUyNTsgZHSkhhDJ5i+6IFlPzKYxsWhga6kgaswgagxCzAJBgNVBAYTAlVT\n" +
"MREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMIQ29sdW1iaWExFzAVBgNVBAoT\n" +
"DkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJjb251czEnMCUGA1UEAxMeQ2ly\n" +
"Y29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4wHAYJKoZIhvcNAQkBFg9jYUBj\n" +
"aXJjb251cy5uZXSCCQDHpX/LJMFVjzAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEB\n" +
"BQUAA4GBAAHBtl15BwbSyq0dMEBpEdQYhHianU/rvOMe57digBmox7ZkPEbB/baE\n" +
"sYJysziA2raOtRxVRtcxuZSMij2RiJDsLxzIp1H60Xhr8lmf7qF6Y+sZl7V36KZb\n" +
"n2ezaOoRtsQl9dhqEMe8zgL76p9YZ5E69Al0mgiifTteyNjjMuIW\n" +
"-----END CERTIFICATE-----\n";

function trap(obj) {
  var payload = JSON.stringify(obj);
  var req = https.request(
    { host: "trap.noit.circonus.net", 
      path: "/module/httptrap/" + trap_uuid + "/" + trap_secret,
      method: "PUT",
      ca: ca,
      headers: {
        'Content-Length': Buffer.byteLength(payload)
      } }, (res) => {
        if(res.statusCode != 200) {
          console.error(payload, res.statusCode);
        }
      });
  req.on('error', (e) => { console.error(e); });
  req.write(payload);
  req.end();
}

var mapping = {
  "dewpoint": 2,
  "temperature": 1,
  "pressure": 3,
  "winddirection": 5,
  "windspeed": 6,
  "windspeed_gust": 7,
  "humidity": 8,
  "precipitation": 12,
  "solarpower": 13
};

https.get("https://www.wunderground.com/weatherstation/WXDailyHistory.asp?ID=" + station + "&day=" + day + "&month=" + month + "&year=" + year + "&graphspan=day&format=1",
    res => {
      res.setEncoding("utf8")
      var body = ""
      res.on("data", data => { body += data })
      res.on("end", () => {
        var lines = body.split(/\n/)
        var data = []
        for(var i=0; i<lines.length; i++) {
          if(! /^[1-9]/.test(lines[i])) continue;
          data.unshift(lines[i]);
        }
        for(var i=0; i<data.length; i++) {
          var line = data[i];
          var parts = line.split(/,/);
          var ts = new Date(parts[parts.length-2].replace(" ","T") + "Z");
          ts = ts.getTime();
          var obj = {};
          for(var field in mapping) {
            obj[field] = { "_ts": ts, "_type": "n", "_value": parts[mapping[field]] };
          }
          trap(obj);
          if(stop_after_one) break;
        }
      })
    })


