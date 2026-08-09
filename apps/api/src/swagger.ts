import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Monte Swagger UI sur `<prefix>/docs`.
 *
 * Appele uniquement hors production : la documentation ne doit pas etre
 * exposee publiquement par defaut.
 *
 * `cleanupOpenApiDoc` convertit les schemas Zod des DTO en schemas OpenAPI
 * exploitables — sans lui les corps de requete apparaissent vides.
 */
export function setupSwagger(app: INestApplication, prefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('Trekker API')
    .setDescription('API du projet trekker')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(`${prefix}/docs`, app, cleanupOpenApiDoc(document), {
    swaggerOptions: { persistAuthorization: true },
  });
}
