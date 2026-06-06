const https = require('https');
const dotenv = require('dotenv');

dotenv.config();

async function send() {
  const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
  if (!MSG91_AUTHKEY) {
    console.error("Please set MSG91_AUTHKEY in your .env file");
    return;
  }

  // Example mock candidate and assessor details
  const studentName = "John Doe";
  const studentEmail = "qcquantumclimb@gmail.com"; 
  const assessorName = "Test Assessor";
  const assessorEmail = "qcquantumclimb@gmail.com"; // Set to the same for testing

  const meetingDate = new Date();
  meetingDate.setHours(meetingDate.getHours() + 2); // 2 hours from now

  const formattedDate = meetingDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = meetingDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

  const recipients = [
    { name: studentName, email: studentEmail },
    { name: assessorName, email: assessorEmail }
  ];

  const msg91Payload = JSON.stringify({
    to: recipients,
    from: {
      name: "Integrated SSB Virtuosos",
      email: "noreply@ssbwithisv.in"
    },
    domain: "noreply.ssbwithisv.in",
    template_id: "interview_template_6",
    variables: {
      candidate_name: studentName,
      date: formattedDate,
      time: formattedTime,
      meeting_link: "https://meet.google.com/abc-defg-hij"
    }
  });

  const options = {
    hostname: 'api.msg91.com',
    path: '/api/v5/email/send',
    method: 'POST',
    headers: {
      'authkey': MSG91_AUTHKEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(msg91Payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\nMSG91 Test Email Dispatched!`);
        console.log(`Response: ${data}\n`);
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error('MSG91 Email Error:', e.message);
      reject(e);
    });
    
    req.write(msg91Payload);
    req.end();
  });
}

send().catch(console.error);
