const nodemailer = require('nodemailer');

async function send() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    auth: {
      user: 'info@ssbwithisv.in',
      pass: 'bcJeyAsYYrAF'
    }
  });

  const emails = [
    { to: 'isvclub2021@gmail.com', role: 'io' },
    { to: 'isvclub2021@gmail.com', role: 'psych' },
    { to: 'isvclub2021@gmail.com', role: 'to' }
  ];

  for (const { to, role } of emails) {
    let meetingMessage = "";
    if (role.toLowerCase() === 'io') {
      meetingMessage = "your mock interview with the Interviewing Officer has been scheduled.";
    } else if (role.toLowerCase() === 'psych') {
      meetingMessage = "Your Psych Test feedback has been scheduled.";
    } else if (role.toLowerCase() === 'to') {
      meetingMessage = "Your TO Test feedback has been scheduled.";
    } else {
      meetingMessage = `Your ${role.toUpperCase()} Test feedback has been scheduled.`;
    }

    await transporter.sendMail({
      from: '"SSB With ISV" <info@ssbwithisv.in>',
      to: to,
      subject: `SSB Feedback Meeting Scheduled (${role.toUpperCase()} Assessor)`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <!-- Using the public logo URL from the main site so it shows up in emails -->
              <img src="https://ssbwithisv.in/assets/logo-b9c1b3f8.png" alt="SSB With ISV Logo" style="max-height: 80px;" />
            </div>
            <h2 style="color: #C5A028; border-bottom: 2px solid #C5A028; padding-bottom: 10px;">Meeting Scheduled</h2>
            <p>Dear Candidate,</p>
            <p>${meetingMessage}</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #C5A028; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 0;"><strong>Meeting Link:</strong> <a href="https://meet.google.com/test-link" style="color: #C5A028; font-weight: bold; text-decoration: none;">Click here to join</a></p>
            </div>
            <p>Please ensure you join the meeting on time.</p>
            <p>Best Regards,<br/><strong>SSB With ISV Evaluation Team</strong></p>
          </body>
        </html>
      `
    });
    console.log(`Sent successfully to ${to}`);
  }
}

send().catch(console.error);
