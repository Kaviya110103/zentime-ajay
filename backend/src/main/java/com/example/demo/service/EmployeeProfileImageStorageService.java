package com.example.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;

@Service
public class EmployeeProfileImageStorageService {
    private static final String LEGACY_IMAGE_PATH = "/api/employees/image/";

    private final Path uploadDir;
    private final boolean s3Enabled;
    private final String bucket;
    private final String region;
    private final String keyPrefix;

    public EmployeeProfileImageStorageService(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.profile-image.s3.enabled:${PROFILE_IMAGE_S3_ENABLED:false}}") boolean s3Enabled,
            @Value("${app.profile-image.s3.bucket:${PROFILE_IMAGE_S3_BUCKET:}}") String bucket,
            @Value("${app.profile-image.s3.region:${AWS_REGION:ap-south-1}}") String region,
            @Value("${app.profile-image.s3.prefix:${PROFILE_IMAGE_S3_PREFIX:employees/profile}}") String keyPrefix) {
        this.uploadDir = Paths.get(uploadDir);
        this.s3Enabled = s3Enabled;
        this.bucket = bucket == null ? "" : bucket.trim();
        this.region = region == null || region.isBlank() ? "ap-south-1" : region.trim();
        this.keyPrefix = cleanPrefix(keyPrefix);
    }

    public String save(Long employeeId, MultipartFile file) throws IOException {
        if (employeeId == null) {
            throw new IllegalArgumentException("Employee id is required for profile image upload");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Profile image file is required");
        }

        String key = buildCanonicalKey(employeeId, file);
        if (isS3Available()) {
            putToS3(key, file);
            return key;
        }

        Path target = uploadDir.resolve(key).normalize();
        Files.createDirectories(target.getParent());
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return key;
    }

    public String normalizeReference(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return rawValue;
        }
        String value = rawValue.trim();
        int legacyIndex = value.indexOf(LEGACY_IMAGE_PATH);
        if (legacyIndex >= 0) {
            return value.substring(legacyIndex + LEGACY_IMAGE_PATH.length());
        }
        if (value.startsWith("/")) {
            return value.substring(1);
        }
        return value;
    }

    public StoredImage load(String rawReference) throws IOException {
        String reference = normalizeReference(rawReference);
        if (reference == null || reference.isBlank()) {
            return null;
        }

        if (isS3Available() && isCanonicalS3Key(reference)) {
            byte[] bytes = s3Client().getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(reference)
                    .build()).asByteArray();
            return new StoredImage(bytes, contentType(reference));
        }

        Path path = uploadDir.resolve(reference).normalize();
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists()) {
            Path legacyPath = uploadDir.resolve(Paths.get(reference).getFileName().toString()).normalize();
            resource = new UrlResource(legacyPath.toUri());
        }
        if (!resource.exists()) {
            return null;
        }
        return new StoredImage(resource, contentType(reference));
    }

    public boolean isCanonicalS3Key(String reference) {
        String value = normalizeReference(reference);
        return value != null && value.startsWith(keyPrefix + "/");
    }

    private boolean isS3Available() {
        return s3Enabled && !bucket.isBlank();
    }

    private void putToS3(String key, MultipartFile file) throws IOException {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType(file.getOriginalFilename()).toString())
                .build();
        s3Client().putObject(request, RequestBody.fromBytes(file.getBytes()));
    }

    private S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .build();
    }

    private String buildCanonicalKey(Long employeeId, MultipartFile file) {
        String extension = extension(file.getOriginalFilename());
        String fileName = "profile-" + UUID.randomUUID() + extension;
        return keyPrefix + "/" + employeeId + "/" + fileName;
    }

    private String extension(String originalName) {
        String cleanName = StringUtils.cleanPath(originalName == null ? "" : originalName);
        int dot = cleanName.lastIndexOf('.');
        if (dot < 0 || dot == cleanName.length() - 1) {
            return ".jpg";
        }
        String ext = cleanName.substring(dot).toLowerCase(Locale.ROOT);
        if (ext.length() > 8 || !ext.matches("\\.[a-z0-9]+")) {
            return ".jpg";
        }
        return ext;
    }

    private MediaType contentType(String name) {
        String lower = String.valueOf(name).toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (lower.endsWith(".gif")) {
            return MediaType.IMAGE_GIF;
        }
        if (lower.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.IMAGE_JPEG;
    }

    private String cleanPrefix(String rawPrefix) {
        String value = rawPrefix == null || rawPrefix.isBlank() ? "employees/profile" : rawPrefix.trim();
        value = value.replace("\\", "/").replaceAll("^/+", "").replaceAll("/+$", "");
        return value.isBlank() ? "employees/profile" : value;
    }

    public record StoredImage(Object body, MediaType contentType) {
    }
}
