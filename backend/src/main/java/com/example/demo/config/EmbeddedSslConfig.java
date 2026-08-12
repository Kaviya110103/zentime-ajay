package com.example.demo.config;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.ssl.DefaultSslBundleRegistry;
import org.springframework.boot.ssl.SslBundle;
import org.springframework.boot.ssl.SslStoreBundle;
import org.springframework.boot.web.server.Ssl;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmbeddedSslConfig {

    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> embeddedSslCustomizer(
            @Value("${app.embedded-ssl.enabled:false}") boolean enabled,
            @Value("${SSL_CERT_BASE64:}") String certBase64,
            @Value("${SSL_KEY_BASE64:}") String keyBase64) {
        return factory -> {
            if (!enabled) {
                return;
            }

            if (certBase64 == null || certBase64.isBlank() || keyBase64 == null || keyBase64.isBlank()) {
                throw new IllegalStateException(
                        "EMBEDDED_SSL_ENABLED=true requires SSL_CERT_BASE64 and SSL_KEY_BASE64.");
            }

            try {
                KeyStore keyStore = buildKeyStore(certBase64, keyBase64);
                Ssl ssl = Ssl.forBundle("zentime");
                DefaultSslBundleRegistry registry = new DefaultSslBundleRegistry();
                registry.registerBundle("zentime", SslBundle.of(SslStoreBundle.of(keyStore, "", null)));
                factory.setSsl(ssl);
                factory.setSslBundles(registry);
            } catch (Exception ex) {
                throw new IllegalStateException("Failed to configure embedded SSL from environment variables.", ex);
            }
        };
    }

    private static KeyStore buildKeyStore(String certBase64, String keyBase64) throws Exception {
        List<Certificate> chain = parseCertificateChain(decodeBase64ToText(certBase64));
        PrivateKey privateKey = parsePrivateKey(decodeBase64ToText(keyBase64));

        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        keyStore.load(null, null);
        keyStore.setKeyEntry("zentime", privateKey, new char[0], chain.toArray(Certificate[]::new));
        return keyStore;
    }

    private static List<Certificate> parseCertificateChain(String pem) throws Exception {
        CertificateFactory factory = CertificateFactory.getInstance("X.509");
        Collection<? extends Certificate> certificates = factory.generateCertificates(
                new ByteArrayInputStream(pem.getBytes(StandardCharsets.UTF_8)));
        List<Certificate> chain = new ArrayList<>(certificates);

        if (chain.isEmpty()) {
            throw new IllegalArgumentException("SSL_CERT_BASE64 does not contain any X.509 certificates.");
        }

        return chain;
    }

    private static PrivateKey parsePrivateKey(String pem) throws Exception {
        String normalized = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        if (normalized.equals(pem.replaceAll("\\s", ""))) {
            throw new IllegalArgumentException("SSL_KEY_BASE64 must contain a PKCS#8 private key PEM.");
        }

        byte[] keyBytes = Base64.getDecoder().decode(normalized);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(keyBytes);

        for (String algorithm : List.of("RSA", "EC", "DSA")) {
            try {
                return KeyFactory.getInstance(algorithm).generatePrivate(keySpec);
            } catch (Exception ignored) {
                // Try the next common key type.
            }
        }

        throw new IllegalArgumentException("Unsupported private key algorithm.");
    }

    private static String decodeBase64ToText(String value) {
        return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
    }
}
