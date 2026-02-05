import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Email service not available in this environment');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected. Please set up the SendGrid integration.');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

export async function getSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

interface BookingNotificationData {
  teacherName: string;
  teacherEmail: string;
  entryType: 'learning_summary' | 'learning_support';
  className: string;
  subjectName: string;
  grade: string;
  term: string;
  weekNumber: number;
  topics?: string;
  quizDay?: string;
  quizDate?: string;
  quizTime?: string;
  sessionType?: string;
  sapetDay?: string;
  sapetDate?: string;
  sapetTime?: string;
  teamsLink?: string;
}

export async function sendBookingNotification(data: BookingNotificationData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const termLabel = data.term.replace('TERM_', 'Term ');
    const entryTypeLabel = data.entryType === 'learning_summary' ? 'Learning Summary' : 'Learning Support (SAPET)';
    
    let scheduleDetails = '';
    if (data.entryType === 'learning_summary') {
      scheduleDetails = data.quizDay && data.quizDate 
        ? `Quiz scheduled for ${data.quizDay}, ${data.quizDate}${data.quizTime ? ` (Period ${data.quizTime})` : ''}`
        : 'No quiz scheduled';
    } else {
      scheduleDetails = data.sapetDay && data.sapetDate
        ? `SAPET session scheduled for ${data.sapetDay}, ${data.sapetDate}${data.sapetTime ? ` at ${data.sapetTime}` : ''}`
        : 'No session scheduled';
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New ${entryTypeLabel} Booking</h2>
        <p>Dear ${data.teacherName},</p>
        <p>Your ${entryTypeLabel.toLowerCase()} entry has been confirmed.</p>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #374151;">Booking Details</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Term:</strong> ${termLabel}</li>
            <li><strong>Week:</strong> ${data.weekNumber}</li>
            <li><strong>Grade:</strong> ${data.grade}</li>
            <li><strong>Class:</strong> ${data.className}</li>
            <li><strong>Subject:</strong> ${data.subjectName}</li>
            ${data.topics ? `<li><strong>Topics:</strong> ${data.topics}</li>` : ''}
            <li><strong>Schedule:</strong> ${scheduleDetails}</li>
            ${data.teamsLink ? `<li><strong>Teams Link:</strong> <a href="${data.teamsLink}">${data.teamsLink}</a></li>` : ''}
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">This is an automated notification from the Exam & Quiz Scheduler system.</p>
      </div>
    `;
    
    await client.send({
      to: data.teacherEmail,
      from: fromEmail,
      subject: `${entryTypeLabel} Booking Confirmation - ${data.className} (${termLabel} Week ${data.weekNumber})`,
      html: htmlContent
    });
    
    console.log(`Booking notification sent to ${data.teacherEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send booking notification:', error);
    return false;
  }
}
