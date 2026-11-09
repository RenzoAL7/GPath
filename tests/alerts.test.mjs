import test from 'node:test'
import assert from 'node:assert/strict'
import { detectOfferAlerts } from '../server/analyzer.mjs'
import { detectSkills, mentionsSkill } from '../shared/skills.mjs'

const ids = (text) => detectOfferAlerts(text).map((alert) => alert.id)

test('detects each scam signal and quotes the line behind it', () => {
  const alerts = detectOfferAlerts(
    'Practicante de ventas. Deberás abonar S/ 80 por el curso de inducción. Envía una foto de tu DNI y tu número de cuenta. Postula únicamente escribiendo al WhatsApp del reclutador. Gana dinero desde casa.',
  )
  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ['payment', 'sensitive-data', 'whatsapp-only', 'easy-money'],
  )
  assert.equal(alerts[0].text, 'Deberás abonar S/ 80 por el curso de inducción.')
  assert.equal(alerts[0].label, 'Pide un pago')
})

test('recognizes common variations', () => {
  assert.deepEqual(ids('Debes yapear S/ 50 para reservar tu cupo.'), ['payment'])
  assert.deepEqual(ids('Costo de inscripción: S/ 30.'), ['payment'])
  assert.deepEqual(ids('Adjunta tus datos bancarios al correo.'), ['sensitive-data'])
  assert.deepEqual(ids('Solo atendemos postulantes por WhatsApp.'), ['whatsapp-only'])
  assert.deepEqual(ids('Ingresos ilimitados desde el primer mes.'), ['easy-money'])
})

test('does not flag normal wording in a legitimate offer', () => {
  for (const text of [
    'Pago quincenal y seguro de salud.',
    'Salario: S/ 3,000 mensuales.',
    'Gestionarás pagos a proveedores y conciliación bancaria.',
    'Capacitación pagada por la empresa.',
    'Dudas sobre la oferta al WhatsApp o al correo de selección.',
    'Experiencia con cuentas por cobrar.',
    'Manejo de SQL y Excel. Modalidad híbrida en Lima.',
  ])
    assert.deepEqual(ids(text), [], text)
})

test('finds catalog skills in CV text with the line that mentions them', () => {
  const skills = detectSkills(
    'Ana Prueba\nProyecto de ventas con SQL y Excel.\nAutomaticé reportes en Python; usé Git.',
  )
  assert.deepEqual(
    skills.map((skill) => skill.name),
    ['SQL', 'Excel', 'Python', 'Git'],
  )
  assert.equal(skills[0].line, 'Proyecto de ventas con SQL y Excel.')
  assert.equal(skills[2].line, 'Automaticé reportes en Python;')
})

test('does not confuse similar words with skills', () => {
  assert.deepEqual(detectSkills('Excelente comunicación y trabajo en GitHub con JavaScript.'), [
    { name: 'JavaScript', line: 'Excelente comunicación y trabajo en GitHub con JavaScript.' },
  ])
})

test('matches a requirement to its quote through the catalog aliases', () => {
  assert.equal(mentionsSkill('Power BI', 'Dashboards en PowerBI.'), true)
  assert.equal(mentionsSkill('Java', 'Experiencia en JavaScript.'), false)
  assert.equal(mentionsSkill('Otra cosa', 'Pide otra cosa.'), true)
})
