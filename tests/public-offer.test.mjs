import test from 'node:test'
import assert from 'node:assert/strict'
import { OfferReadError, readPublicOffer, validatePublicOfferUrl } from '../server/public-offer.mjs'

test('only accepts standard HTTPS public-offer URLs before any request', () => {
  for (const value of [
    'http://jobs.example.com/opening',
    'file:///etc/passwd',
    'https://user:password@jobs.example.com/opening',
    'https://jobs.example.com:8443/opening',
    'https://localhost/opening',
    'https://127.0.0.1/opening',
    'https://[::1]/opening',
  ]) {
    assert.throws(() => validatePublicOfferUrl(value), OfferReadError)
  }
  assert.equal(
    validatePublicOfferUrl('https://jobs.example.com/opening').toString(),
    'https://jobs.example.com/opening',
  )
  assert.equal(
    validatePublicOfferUrl(
      'https://www.linkedin.com/jobs/search-results/?currentJobId=4463490846',
    ).toString(),
    'https://www.linkedin.com/jobs/view/4463490846',
  )
  assert.throws(
    () =>
      validatePublicOfferUrl(
        'https://www.linkedin.com/jobs/search-results/?keywords=data%20engineer',
      ),
    /búsqueda de LinkedIn/i,
  )
})

test('blocks private DNS answers and validates each redirect before reading content', async () => {
  await assert.rejects(
    readPublicOffer('https://jobs.example.com/opening', {
      lookup: async () => [{ address: '10.0.0.2', family: 4 }],
      request: async () => {
        throw new Error('must not request a private address')
      },
    }),
    OfferReadError,
  )

  let lookups = 0
  await assert.rejects(
    readPublicOffer('https://jobs.example.com/opening', {
      lookup: async () => {
        lookups++
        return lookups === 1
          ? [{ address: '8.8.8.8', family: 4 }]
          : [{ address: '192.168.1.10', family: 4 }]
      },
      request: async () => ({
        status: 302,
        headers: { location: 'https://redirect.example.com/private' },
        body: '',
      }),
    }),
    OfferReadError,
  )
  assert.equal(lookups, 2)
})

test('returns only supported text content after a pinned public lookup', async () => {
  const result = await readPublicOffer('https://jobs.example.com/opening', {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async (_url, address) => {
      assert.deepEqual(address, { address: '8.8.8.8', family: 4 })
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<p>Python and SQL</p>',
      }
    },
  })
  assert.deepEqual(result, {
    originalUrl: 'https://jobs.example.com/opening',
    text: '<p>Python and SQL</p>',
  })
})

test('explains when LinkedIn redirects an individual offer to sign-in', async () => {
  await assert.rejects(
    readPublicOffer('https://www.linkedin.com/jobs/view/4463490846', {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => ({
        status: 302,
        headers: {
          location:
            'https://www.linkedin.com/uas/login?session_redirect=%2Fjobs%2Fview%2F4463490846',
        },
        body: '',
      }),
    }),
    /LinkedIn pide iniciar sesión/i,
  )
})
