import {
  SubscribeMessage,
  WebSocketGateway,
  WsResponse,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets'
import { Socket } from 'socket.io'

@WebSocketGateway(3002)
export class EventsGateway {

  private rooms: {
    [key: string]: {
      '1': Socket,
      '2'?: Socket,
    }
  } = {};

  private clients: Socket[] = [];

  isClientConnected (id: string) {
    return this.clients.some( client => client.id === id)
  }

  getRoomsAbleToPlay () {
    const { rooms } = this
    const roomKeys = Object.keys(this.rooms)
    if (!roomKeys.length) return []
    return roomKeys.filter( key => !!rooms[key]['1'] && !rooms[key]['2'] )
  }

  @SubscribeMessage('connected')
  handleConnected(
    @ConnectedSocket() client: Socket,
  ): void {
    !this.isClientConnected(client.id) && this.clients.push(client)
  }

  @SubscribeMessage('getRooms')
  handleGetRooms(): WsResponse {
    return { event: 'onGetRooms', data: this.getRoomsAbleToPlay() }
  }

  @SubscribeMessage('ballOver')
  handleForceStop(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket
  ): void {
    const { roomId, to, pointOf } = payload
    const clientToEmit = this.rooms[roomId][to]
    clientToEmit.emit('ballOver', pointOf)
    client.emit('ballOver', pointOf)
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any
  ): void {
    const { roomId } = payload
    client.join(roomId)
    this.rooms[roomId] = this.rooms[roomId] && { ...this.rooms[roomId], '2': client }
    this.rooms[roomId]['1'].emit('startGame')
    this.rooms[roomId]['2'].emit('startGame')
  }

  @SubscribeMessage('stickMoved')
  handleMessage(@MessageBody() payload: any): void {
    const { room, to, y } = payload
    const clientById: Socket = this.rooms[room] && this.rooms[room][to]
    clientById && clientById.emit('moveStick', { y })
  }

  @SubscribeMessage('createRoom')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
  ): WsResponse {
    const { id } = client
    this.rooms[id] = { '1': client }
    client.join(id)
    return { event: 'roomCreated', data: id }
  }
}
