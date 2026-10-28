import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:qr_flutter/qr_flutter.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:8080',
);
const secureStorage = FlutterSecureStorage();

void main() {
  runApp(const PassengerApp());
}

class PassengerApp extends StatefulWidget {
  const PassengerApp({super.key});

  @override
  State<PassengerApp> createState() => _PassengerAppState();
}

class _PassengerAppState extends State<PassengerApp> {
  String? _token;
  String? _name;
  String? _userId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final token = await secureStorage.read(key: 'access_token');
    final name = await secureStorage.read(key: 'passenger_name');
    final userId = await secureStorage.read(key: 'passenger_id');
    final role = await secureStorage.read(key: 'passenger_role');
    if (token != null) {
      try {
        final profile = await ApiClient(token).get('/api/users/profile');
        if (profile['role'] != 'PASSENGER') {
          await _clearCredentials();
        } else {
          _token = token;
          _name = profile['fullName'] as String? ?? name;
          _userId = profile['id'] as String? ?? userId;
          if (_name != null) {
            await secureStorage.write(key: 'passenger_name', value: _name);
          }
        }
      } on ApiException {
        await _clearCredentials();
      } catch (_) {
        if (role == 'PASSENGER' && userId != null && name != null) {
          _token = token;
          _name = name;
          _userId = userId;
        } else {
          await _clearCredentials();
        }
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _signedIn(String token, String name, String userId) async {
    await secureStorage.write(key: 'access_token', value: token);
    await secureStorage.write(key: 'passenger_name', value: name);
    await secureStorage.write(key: 'passenger_id', value: userId);
    await secureStorage.write(key: 'passenger_role', value: 'PASSENGER');
    if (mounted) setState(() {
      _token = token;
      _name = name;
      _userId = userId;
    });
  }

  Future<void> _signedOut() async {
    await _clearCredentials();
    if (mounted) setState(() {
      _token = null;
      _name = null;
      _userId = null;
    });
  }

  Future<void> _clearCredentials() async {
    await secureStorage.delete(key: 'access_token');
    await secureStorage.delete(key: 'passenger_name');
    await secureStorage.delete(key: 'passenger_id');
    await secureStorage.delete(key: 'passenger_role');
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ET-Trans Passenger',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff047857)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xfff1f5f9),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          filled: true,
          fillColor: Colors.white,
        ),
      ),
      home: _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _token == null
              ? AuthScreen(onSignedIn: _signedIn)
              : PassengerHome(
                  token: _token!,
                  passengerName: _name ?? 'Passenger',
                  passengerId: _userId!,
                  onSignOut: _signedOut,
                ),
    );
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient([this.token]);
  final String? token;
  final http.Client _client = http.Client();

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$apiBaseUrl$path').replace(queryParameters: query);

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final response = await _client.get(_uri(path, query), headers: _headers);
    return _decode(response);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      _uri(path),
      headers: {..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    dynamic payload;
    try {
      payload = response.body.isEmpty ? null : jsonDecode(response.body);
    } on FormatException {
      payload = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = payload is Map
          ? payload['detail'] ?? payload['message'] ?? payload['error']
          : null;
      throw ApiException(
        message?.toString() ?? 'Request failed (${response.statusCode}).',
        statusCode: response.statusCode,
      );
    }
    return payload;
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.onSignedIn, super.key});
  final Future<void> Function(String token, String name, String userId) onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ApiClient();
      if (_register) {
        await api.post('/api/auth/register', {
          'fullName': _name.text.trim(),
          'phoneNumber': _phone.text.trim(),
          'password': _password.text,
        });
      }
      final result = await api.post('/api/auth/login', {
        'phoneNumber': _phone.text.trim(),
        'password': _password.text,
      }) as Map<String, dynamic>;
      final user = result['user'] as Map<String, dynamic>;
      if (user['role'] != 'PASSENGER') {
        throw ApiException('This app is for passenger accounts only.');
      }
      await widget.onSignedIn(
        result['accessToken'] as String,
        user['fullName'] as String,
        user['id'] as String,
      );
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error = 'Unable to connect to the transport service.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                elevation: 1,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(Icons.directions_bus_filled,
                            color: Color(0xff047857), size: 44),
                        const SizedBox(height: 12),
                        Text(
                          _register ? 'Create passenger account' : 'Welcome to ET-Trans',
                          style: Theme.of(context).textTheme.headlineSmall,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Search trips, reserve seats, and keep your ticket ready offline.',
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        if (_register) ...[
                          TextFormField(
                            controller: _name,
                            decoration: const InputDecoration(labelText: 'Full name'),
                            validator: (value) =>
                                (value?.trim().isNotEmpty ?? false) ? null : 'Enter your name.',
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextFormField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(labelText: 'Phone number'),
                          validator: (value) => RegExp(r'^(09\d{8}|\+2519\d{8})$')
                                  .hasMatch(value?.trim() ?? '')
                              ? null
                              : 'Use 09xxxxxxxx or +2519xxxxxxxx.',
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _password,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Password'),
                          validator: (value) => (value?.length ?? 0) >= 8
                              ? null
                              : 'Password must contain at least 8 characters.',
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Text(_error!, style: const TextStyle(color: Colors.red)),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _busy ? null : _submit,
                          child: Text(_busy ? 'Please wait…' : _register ? 'Register' : 'Sign in'),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                    _register = !_register;
                                    _error = null;
                                  }),
                          child: Text(_register
                              ? 'Already registered? Sign in'
                              : 'New passenger? Create account'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class City {
  const City({required this.id, required this.name});
  final String id;
  final String name;
  factory City.fromJson(Map<String, dynamic> json) =>
      City(id: json['id'] as String, name: json['name'] as String);
}

class Trip {
  const Trip({
    required this.id,
    required this.sourceCity,
    required this.sourceTerminal,
    required this.destinationCity,
    required this.destinationTerminal,
    required this.departureAt,
    required this.durationMinutes,
    required this.busLevel,
    required this.price,
    required this.availableSeats,
    required this.plateNumber,
  });

  final String id;
  final String sourceCity;
  final String sourceTerminal;
  final String destinationCity;
  final String destinationTerminal;
  final DateTime departureAt;
  final int durationMinutes;
  final int busLevel;
  final num price;
  final int availableSeats;
  final String plateNumber;

  factory Trip.fromJson(Map<String, dynamic> json) => Trip(
        id: json['id'] as String,
        sourceCity: json['sourceCity'] as String,
        sourceTerminal: json['sourceTerminal'] as String,
        destinationCity: json['destinationCity'] as String,
        destinationTerminal: json['destinationTerminal'] as String,
        departureAt: DateTime.parse(json['departureAt'] as String),
        durationMinutes: json['durationMinutes'] as int? ?? 0,
        busLevel: json['busLevel'] as int,
        price: json['price'] as num,
        availableSeats: json['availableSeats'] as int,
        plateNumber: json['plateNumber'] as String,
      );
}

class Seat {
  const Seat({
    required this.id,
    required this.label,
    required this.status,
  });
  final String id;
  final String label;
  final String status;
  factory Seat.fromJson(Map<String, dynamic> json) => Seat(
        id: json['seatId'] as String,
          label: json['seatLabel'] as String? ?? '${json['seatNumber']}',
        status: json['status'] as String,
      );
}

class Ticket {
  const Ticket({
    required this.bookingId,
    required this.scheduleId,
    required this.passengerName,
    required this.seatNumber,
    required this.seatLabel,
    required this.paidAt,
    required this.qrData,
  });
  final String bookingId;
  final String scheduleId;
  final String passengerName;
  final int seatNumber;
  final String seatLabel;
  final String paidAt;
  final String qrData;

  factory Ticket.fromJson(Map<String, dynamic> json) => Ticket(
        bookingId: json['bookingId'] as String,
        scheduleId: json['scheduleId'] as String,
        passengerName: json['passengerName'] as String,
        seatNumber: json['seatNumber'] as int,
        seatLabel: json['seatLabel'] as String? ?? '${json['seatNumber']}',
        paidAt: json['paidAt'] as String? ?? '',
        qrData: json['qrData'] as String,
      );
  Map<String, dynamic> toJson() => {
        'bookingId': bookingId,
        'scheduleId': scheduleId,
        'passengerName': passengerName,
        'seatNumber': seatNumber,
        'seatLabel': seatLabel,
        'paidAt': paidAt,
        'qrData': qrData,
      };
}

class PassengerHome extends StatefulWidget {
  const PassengerHome({
    required this.token,
    required this.passengerName,
    required this.passengerId,
    required this.onSignOut,
    super.key,
  });
  final String token;
  final String passengerName;
  final String passengerId;
  final Future<void> Function() onSignOut;

  @override
  State<PassengerHome> createState() => _PassengerHomeState();
}

class _PassengerHomeState extends State<PassengerHome> {
  int _index = 0;
  List<Ticket> _tickets = [];

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    final raw = await secureStorage.read(key: 'offline_tickets_${widget.passengerId}');
    if (raw == null) return;
    try {
      final items = jsonDecode(raw) as List<dynamic>;
      if (mounted) setState(() => _tickets = items
          .map((item) => Ticket.fromJson(item as Map<String, dynamic>))
          .toList());
    } on FormatException {
      await secureStorage.delete(key: 'offline_tickets');
    } on TypeError {
      await secureStorage.delete(key: 'offline_tickets');
    }
  }

  Future<void> _saveTicket(Ticket ticket) async {
    final tickets = [
      ticket,
      ..._tickets.where((item) => item.bookingId != ticket.bookingId),
    ];
    await secureStorage.write(
      key: 'offline_tickets_${widget.passengerId}',
      value: jsonEncode(tickets.map((item) => item.toJson()).toList()),
    );
    if (mounted) setState(() => _tickets = tickets);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      SearchScreen(
        token: widget.token,
        onTicketSaved: _saveTicket,
      ),
      TicketsScreen(tickets: _tickets),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(_index == 0 ? 'Hello, ${widget.passengerName}' : 'My bookings'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => widget.onSignOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: screens[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
          NavigationDestination(icon: Icon(Icons.confirmation_number), label: 'My bookings'),
        ],
      ),
    );
  }
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({
    required this.token,
    required this.onTicketSaved,
    super.key,
  });
  final String token;
  final Future<void> Function(Ticket ticket) onTicketSaved;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final ApiClient _api = ApiClient(widget.token);
  List<City> _cities = [];
  List<Trip> _trips = [];
  String? _source;
  String? _destination;
  DateTime _date = DateTime.now();
  int? _busLevel;
  bool _loadingCities = true;
  bool _searching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCities();
  }

  Future<void> _loadCities() async {
    try {
      final data = await _api.get('/api/locations/cities') as List<dynamic>;
      if (mounted) setState(() {
        _cities = data.map((item) => City.fromJson(item as Map<String, dynamic>)).toList();
        _loadingCities = false;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() {
        _error = error.message;
        _loadingCities = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _error = 'Unable to load city list.';
        _loadingCities = false;
      });
    }
  }

  Future<void> _chooseDate() async {
    final chosen = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (chosen != null) setState(() => _date = chosen);
  }

  Future<void> _search() async {
    if (_source == null || _destination == null || _source == _destination) {
      setState(() => _error = 'Choose different source and destination cities.');
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
      _trips = [];
    });
    try {
      final date =
          '${_date.year.toString().padLeft(4, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
      final query = <String, String>{
        'sourceCityId': _source!,
        'destinationCityId': _destination!,
        'date': date,
        if (_busLevel != null) 'busLevel': '$_busLevel',
      };
      final result = await _api.get('/api/schedules/search', query: query) as List<dynamic>;
      if (mounted) setState(() => _trips = result
          .map((item) => Trip.fromJson(item as Map<String, dynamic>))
          .toList());
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to search trips.');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingCities) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  value: _source,
                  decoration: const InputDecoration(labelText: 'From city'),
                  items: _cities.map((city) => DropdownMenuItem(
                    value: city.id,
                    child: Text(city.name, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (value) => setState(() => _source = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _destination,
                  decoration: const InputDecoration(labelText: 'To city'),
                  items: _cities.map((city) => DropdownMenuItem(
                    value: city.id,
                    child: Text(city.name, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (value) => setState(() => _destination = value),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _chooseDate,
                        icon: const Icon(Icons.calendar_month),
                        label: Text('${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        value: _busLevel,
                        decoration: const InputDecoration(labelText: 'Bus grade'),
                        items: const [
                          DropdownMenuItem<int?>(value: null, child: Text('Any grade')),
                          DropdownMenuItem<int?>(value: 1, child: Text('Grade 1')),
                          DropdownMenuItem<int?>(value: 2, child: Text('Grade 2')),
                          DropdownMenuItem<int?>(value: 3, child: Text('Grade 3')),
                        ],
                        onChanged: (value) => setState(() => _busLevel = value),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _searching ? null : _search,
                    icon: const Icon(Icons.search),
                    label: Text(_searching ? 'Searching…' : 'Search available trips'),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_error != null) _ErrorBanner(message: _error!),
        if (!_searching && _trips.isEmpty && _error == null)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Select your route and search for available trips.',
                textAlign: TextAlign.center),
          ),
        ..._trips.map((trip) => TripCard(
              trip: trip,
              token: widget.token,
              onTicketSaved: widget.onTicketSaved,
            )),
      ],
    );
  }
}

class TripCard extends StatelessWidget {
  const TripCard({
    required this.trip,
    required this.token,
    required this.onTicketSaved,
    super.key,
  });
  final Trip trip;
  final String token;
  final Future<void> Function(Ticket ticket) onTicketSaved;

  @override
  Widget build(BuildContext context) {
    final departure = trip.departureAt.toLocal();
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text('${trip.sourceCity} → ${trip.destinationCity}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold))),
              Text('${trip.price} ETB', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xff047857))),
            ]),
            const SizedBox(height: 8),
            Text('${trip.sourceTerminal} → ${trip.destinationTerminal}'),
            Text('${departure.toString().substring(0, 16)} · Grade ${trip.busLevel} · ${trip.availableSeats} seats left'),
            Text('${trip.plateNumber} · ${trip.durationMinutes} min'),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => SeatMapScreen(
                    trip: trip,
                    token: token,
                    onTicketSaved: onTicketSaved,
                  ),
                )),
                child: const Text('Choose seats'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SeatMapScreen extends StatefulWidget {
  const SeatMapScreen({
    required this.trip,
    required this.token,
    required this.onTicketSaved,
    super.key,
  });
  final Trip trip;
  final String token;
  final Future<void> Function(Ticket ticket) onTicketSaved;

  @override
  State<SeatMapScreen> createState() => _SeatMapScreenState();
}

class _SeatMapScreenState extends State<SeatMapScreen> {
  late final ApiClient _api = ApiClient(widget.token);
  List<Seat> _seats = [];
  final Set<String> _selectedSeatIds = {};
  bool _loading = true;
  bool _holding = false;
  String? _error;
  DateTime? _holdExpiresAt;
  Timer? _timer;
  Duration _remaining = Duration.zero;
  List<HeldBooking> _heldBookings = [];

  @override
  void initState() {
    super.initState();
    _loadSeats();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadSeats() async {
    try {
      final response = await _api.get('/api/schedules/${widget.trip.id}/seats') as Map<String, dynamic>;
      if (mounted) setState(() {
        _seats = (response['seats'] as List<dynamic>)
            .map((item) => Seat.fromJson(item as Map<String, dynamic>))
            .toList();
        _loading = false;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _error = 'Unable to load this trip seat map.';
        _loading = false;
      });
    }
  }

  void _toggleSeat(Seat seat) {
    if (seat.status != 'AVAILABLE' || _holdExpiresAt != null) return;
    setState(() {
      if (_selectedSeatIds.contains(seat.id)) {
        _selectedSeatIds.remove(seat.id);
      } else if (_selectedSeatIds.length < 5) {
        _selectedSeatIds.add(seat.id);
      }
    });
  }

  Future<void> _holdSeats() async {
    setState(() {
      _holding = true;
      _error = null;
    });
    try {
      final result = await _api.post('/api/bookings/lock-seats', {
        'scheduleId': widget.trip.id,
        'seatIds': _selectedSeatIds.toList(),
      }) as Map<String, dynamic>;
      final expiresAt = DateTime.parse(result['expiresAt'] as String).toLocal();
      final seats = result['seats'] as List<dynamic>;
      if (mounted) setState(() {
        _heldBookings = seats.map((item) {
          final booking = item as Map<String, dynamic>;
          return HeldBooking(
            bookingId: booking['bookingId'] as String,
            seatId: booking['seatId'] as String,
          );
        }).toList();
        _holdExpiresAt = expiresAt;
        _selectedSeatIds.clear();
      });
      if (mounted) _startCountdown();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
      await _loadSeats();
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to reserve selected seats.');
    } finally {
      if (mounted) setState(() => _holding = false);
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    final expiresAt = _holdExpiresAt;
    if (expiresAt != null) {
      setState(() {
        _remaining = expiresAt.difference(DateTime.now());
      });
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final expires = _holdExpiresAt;
      if (expires == null) return;
      final remaining = expires.difference(DateTime.now());
      if (remaining <= Duration.zero) {
        _timer?.cancel();
        setState(() {
          _remaining = Duration.zero;
          _holdExpiresAt = null;
          _heldBookings = [];
          _error = 'Your 10-minute seat hold expired. Please select seats again.';
        });
        _loadSeats();
      } else {
        setState(() => _remaining = remaining);
      }
    });
  }

  Future<void> _checkout() async {
    final provider = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(
                'Mock payment · ${(widget.trip.price * _heldBookings.length).toStringAsFixed(2)} ETB total',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 14),
            ListTile(
              leading: const Icon(Icons.phone_android),
              title: const Text('Telebirr'),
              onTap: () => Navigator.pop(context, 'TELEBIRR'),
            ),
            ListTile(
              leading: const Icon(Icons.account_balance),
              title: const Text('CBE Birr'),
              onTap: () => Navigator.pop(context, 'CBE_BIRR'),
            ),
          ]),
        ),
      ),
    );
    if (provider == null) return;
    setState(() {
      _holding = true;
      _error = null;
    });
    try {
      for (final held in _heldBookings) {
        Map<String, dynamic> json;
        try {
          json = await _api.get('/api/bookings/${held.bookingId}/ticket')
              as Map<String, dynamic>;
        } on ApiException catch (error) {
          if (error.statusCode != 404) rethrow;
          await _api.post('/api/bookings/${held.bookingId}/mock-payment', {
            'provider': provider,
          });
          json = await _api.get('/api/bookings/${held.bookingId}/ticket')
              as Map<String, dynamic>;
        }
        await widget.onTicketSaved(Ticket.fromJson(json));
      }
      if (!mounted) return;
      _timer?.cancel();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment successful. Tickets are saved for offline access.')),
      );
      Navigator.pop(context);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Payment did not complete. Your seat hold remains active until it expires.');
    } finally {
      if (mounted) setState(() => _holding = false);
    }
  }

  String get _countdown {
    final minutes = _remaining.inMinutes.toString().padLeft(2, '0');
    final seconds = (_remaining.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final columns = _seats.length > 50 ? 5 : 4;
    return Scaffold(
      appBar: AppBar(title: const Text('Choose seats')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(spacing: 12, runSpacing: 8, children: const [
              _Legend(color: Color(0xff10b981), label: 'Available'),
              _Legend(color: Color(0xfff59e0b), label: 'Selected'),
              _Legend(color: Color(0xff94a3b8), label: 'Unavailable'),
            ]),
          ),
          if (_error != null) Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _ErrorBanner(message: _error!),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                childAspectRatio: 1.05,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: _seats.length,
              itemBuilder: (context, index) {
                final seat = _seats[index];
                final selected = _selectedSeatIds.contains(seat.id);
                final available = seat.status == 'AVAILABLE';
                return InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _toggleSeat(seat),
                  child: Container(
                    decoration: BoxDecoration(
                      color: selected
                          ? Colors.amber.shade400
                          : available
                              ? Colors.teal.shade100
                              : Colors.blueGrey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? Colors.amber.shade800 : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(selected ? Icons.check : Icons.event_seat,
                            size: 20, color: available ? Colors.teal.shade900 : Colors.blueGrey),
                        Text(seat.label, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ]),
                    ),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_holdExpiresAt != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        'Seats held · $_countdown remaining',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepOrange),
                      ),
                    ),
                  FilledButton(
                    onPressed: _holding
                        ? null
                        : _holdExpiresAt == null
                            ? _selectedSeatIds.isEmpty
                                ? null
                                : _holdSeats
                            : _checkout,
                    child: Text(_holding
                        ? 'Processing…'
                        : _holdExpiresAt == null
                            ? 'Book now (${_selectedSeatIds.length}/5)'
                            : 'Continue to mock checkout'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HeldBooking {
  const HeldBooking({required this.bookingId, required this.seatId});
  final String bookingId;
  final String seatId;
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 12)),
      ]);
}

class TicketsScreen extends StatelessWidget {
  const TicketsScreen({required this.tickets, super.key});
  final List<Ticket> tickets;

  @override
  Widget build(BuildContext context) {
    if (tickets.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Text('Your paid digital tickets will appear here and remain available offline.',
              textAlign: TextAlign.center),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: tickets.length,
      itemBuilder: (context, index) => Card(
        child: ListTile(
          leading: const Icon(Icons.qr_code_2, color: Color(0xff047857), size: 34),
          title: Text('Seat ${tickets[index].seatLabel}'),
          subtitle: Text('Schedule ${tickets[index].scheduleId.substring(0, 8)}…'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => TicketDetailScreen(ticket: tickets[index]),
          )),
        ),
      ),
    );
  }
}

class TicketDetailScreen extends StatelessWidget {
  const TicketDetailScreen({required this.ticket, super.key});
  final Ticket ticket;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Digital ticket')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified, size: 36, color: Color(0xff047857)),
                  const SizedBox(height: 8),
                  Text(ticket.passengerName,
                      style: Theme.of(context).textTheme.titleLarge,
                      textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  Text('Seat ${ticket.seatLabel} · Schedule ${ticket.scheduleId}'),
                  const SizedBox(height: 20),
                  QrImageView(
                    data: ticket.qrData,
                    version: QrVersions.auto,
                    size: 260,
                    backgroundColor: Colors.white,
                    errorCorrectionLevel: QrErrorCorrectLevel.H,
                  ),
                  const SizedBox(height: 8),
                  const Text('Show this QR code to the terminal clerk.',
                      textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  const Text('Stored securely for offline access',
                      style: TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          border: Border.all(color: Colors.red.shade200),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(message, style: TextStyle(color: Colors.red.shade900)),
      );
}
