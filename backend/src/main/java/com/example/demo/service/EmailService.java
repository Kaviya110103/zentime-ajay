package com.example.demo.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.core.io.ByteArrayResource;

import jakarta.mail.internet.MimeMessage;

import com.example.demo.MODELS.EmailDetails;

@Service
public class EmailService {
    
    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String configuredSender;

    @Value("${spring.mail.password:}")
    private String configuredPassword;

    public String sendEmail(EmailDetails emailDetails) {
        try {
            ensureMailConfigured();
            SimpleMailMessage mailMessage = new SimpleMailMessage();
            mailMessage.setFrom(emailDetails.getSender());
            mailMessage.setTo(emailDetails.getReceiver());
            mailMessage.setSubject(emailDetails.getSubject());
            mailMessage.setText(emailDetails.getMessage());

            mailSender.send(mailMessage);
            return "Email sent successfully!";
        } catch (Exception e) {
            if (e instanceof IllegalStateException runtimeException) {
                throw runtimeException;
            }
            throw new IllegalStateException("Failed to send email", e);
        }
    }

    public String sendEmailWithAttachment(
            String sender,
            String receiver,
            String subject,
            String message,
            byte[] attachmentBytes,
            String attachmentFileName,
            String contentType) {
        try {
            ensureMailConfigured();
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(sender);
            helper.setTo(receiver);
            helper.setSubject(subject);
            helper.setText(message, false);
            helper.addAttachment(
                    attachmentFileName,
                    new ByteArrayResource(attachmentBytes),
                    contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType);
            mailSender.send(mimeMessage);
            return "Email with attachment sent successfully!";
        } catch (Exception e) {
            if (e instanceof IllegalStateException runtimeException) {
                throw runtimeException;
            }
            throw new IllegalStateException("Failed to send email with attachment", e);
        }
    }

    private void ensureMailConfigured() {
        if (configuredSender == null || configuredSender.isBlank()
                || configuredPassword == null || configuredPassword.isBlank()) {
            throw new IllegalStateException("Email is not configured. Set MAIL_USERNAME and MAIL_PASSWORD.");
        }
    }
}
