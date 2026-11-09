package com.example.demo.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.MODELS.AdminPushToken;

public interface AdminPushTokenRepository extends JpaRepository<AdminPushToken, Long> {
    Optional<AdminPushToken> findByClientIdAndToken(Long clientId, String token);

    @Query("select t.token from AdminPushToken t where t.clientId = :clientId")
    List<String> findTokensByClientId(@Param("clientId") Long clientId);
}
