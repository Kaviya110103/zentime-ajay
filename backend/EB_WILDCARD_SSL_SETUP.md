# Elastic Beanstalk Wildcard SSL Setup

Use one wildcard certificate for test and production when backend domains are one-level under `zentime.co.in`, for example `test2.zentime.co.in` and `api.zentime.co.in`.

The certificate should be for `*.zentime.co.in`. It will not cover `zentime.co.in` itself or deeper domains like `api.prod.zentime.co.in`.

Set these Elastic Beanstalk environment variables in test and production:

```env
SSL_CERT_BASE64=<base64 of fullchain.pem>
SSL_KEY_BASE64=<base64 of privkey.pem>
```

For jar-only embedded HTTPS, also set:

```env
EMBEDDED_SSL_ENABLED=true
PORT=443
```

For the zip/nginx deployment, keep `EMBEDDED_SSL_ENABLED=false`.

## Automatic EC2 Certificate

For a normal backend domain certificate created on the EC2 instance during Elastic Beanstalk deploy:

```env
AUTO_SSL_ENABLED=true
SSL_DOMAIN=test2.zentime.co.in
SSL_EMAIL=admin@zentime.co.in
EMBEDDED_SSL_ENABLED=false
```

Use the production backend domain in production. The domain must already point to the Elastic Beanstalk instance, and port 80 plus port 443 must be open in the EC2 Security Group.

Wildcard certificates like `*.zentime.co.in` cannot be created with this HTTP challenge hook. Wildcard certificates require DNS challenge or ACM/load balancer.

Generate the values on Windows:

```powershell
.\scripts\encode-eb-ssl-env.ps1 -FullChainPath C:\path\fullchain.pem -PrivateKeyPath C:\path\privkey.pem
```

For single-instance Elastic Beanstalk, also open inbound HTTPS in the EC2 Security Group:

```text
Type: HTTPS
Port: 443
Source: 0.0.0.0/0
```

Upload the prepared zip bundle, not only the jar file. The zip contains the jar plus the `.platform` nginx HTTPS configuration.
