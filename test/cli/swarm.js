/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const { expect } = require('interface-ipfs-core/src/utils/mocha')
const sinon = require('sinon')
const multiaddr = require('multiaddr')
const PeerInfo = require('peer-info')
const ipfsExec = require('../utils/ipfs-exec')
const PeerId = require('peer-id')
const addrsCommand = require('../../src/cli/commands/swarm/addrs')
const factory = require('../utils/factory')

describe('swarm', () => {
  const df = factory({ type: 'js' })
  afterEach(() => {
    sinon.restore()
  })

  describe('daemon on (through http-api)', function () {
    this.timeout(60 * 1000)

    let bMultiaddr
    let ipfsA

    before(async function () {
      // CI takes longer to instantiate the daemon, so we need to increase the
      // timeout for the before step
      this.timeout(80 * 1000)

      const res = await Promise.all([
        df.spawn(),
        df.spawn()
      ])
      ipfsA = ipfsExec(res[0].path)
      const id = await res[1].api.id()
      bMultiaddr = id.addresses[0]
    })

    after(() => df.clean())

    it('connect', async () => {
      const out = await ipfsA(`swarm connect ${bMultiaddr}`)
      expect(out).to.eql(`connect ${bMultiaddr} success\n`)
    })

    it('peers', async () => {
      const out = await ipfsA('swarm peers')
      expect(out).to.eql(bMultiaddr + '\n')
    })

    it('addrs', async () => {
      const out = await ipfsA('swarm addrs')
      expect(out).to.have.length.above(1)
    })

    it('addrs local', async () => {
      const out = await ipfsA('swarm addrs local')
      expect(out).to.have.length.above(1)
    })

    it('disconnect', async () => {
      const out = await ipfsA(`swarm disconnect ${bMultiaddr}`)
      expect(out).to.eql(
        `disconnect ${bMultiaddr} success\n`
      )
    })

    it('`peers` should not throw after `disconnect`', async () => {
      const out = await ipfsA('swarm peers')
      expect(out).to.be.empty()
    })
  })

  describe('handlers', () => {
    let peerInfo
    const ipfs = {
      swarm: { addrs: () => {} }
    }
    const argv = {
      resolve: () => {},
      getIpfs: () => ipfs
    }

    describe('addrs', () => {
      before(async () => {
        const peerId = await PeerId.create({ bits: 512 })
        peerInfo = new PeerInfo(peerId)
      })

      it('should return addresses for all peers', (done) => {
        sinon.stub(argv, 'resolve').callsFake(promise => {
          promise.then(({ data }) => {
            expect(data).to.eql([
              `${peerInfo.id.toB58String()} (2)`,
              '\t/ip4/127.0.0.1/tcp/4001',
              '\t/ip4/127.0.0.1/tcp/4001/ws'
            ].join('\n'))
            done()
          })
        })

        sinon.stub(peerInfo.multiaddrs, '_multiaddrs').value([
          multiaddr('/ip4/127.0.0.1/tcp/4001'),
          multiaddr(`/ip4/127.0.0.1/tcp/4001/ws/ipfs/${peerInfo.id.toB58String()}`)
        ])

        sinon.stub(ipfs.swarm, 'addrs').returns(
          Promise.resolve([peerInfo])
        )

        addrsCommand.handler(argv)
      })
    })
  })
})
